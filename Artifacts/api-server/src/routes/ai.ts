import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { RunAiOperationBody } from "@workspace/api-zod";
import { aiUsageLimiter, AiLimitError } from "../services/ai/limits";
import { AiProviderError } from "../services/ai/provider";
import {
  AiValidationError,
  prepareAiServiceOperation,
  runAiServiceOperation,
  type AiOperationInput,
} from "../services/ai/service";

const router: IRouter = Router();

router.post("/ai/operations", async (req, res): Promise<void> => {
  const parsed = RunAiOperationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ validationIssues: parsed.error.issues.length }, "Rejected invalid AI operation");
    res.status(400).json({
      error: "Invalid AI request.",
      code: "AI_INVALID_REQUEST",
      retryable: false,
    });
    return;
  }

  const requestId = randomUUID();
  const input = parsed.data as AiOperationInput;
  let prepared;
  try {
    prepared = prepareAiServiceOperation(input);
  } catch (error) {
    if (error instanceof AiValidationError) {
      res.status(400).json({ error: error.message, code: error.code, retryable: false });
      return;
    }
    throw error;
  }
  // UTF-8 bytes across the exact provider messages are a conservative upper
  // bound for model input tokens, including high-density non-ASCII content.
  const reservedInputTokens = Buffer.byteLength(prepared.systemPrompt, "utf8")
    + Buffer.byteLength(prepared.userPrompt, "utf8");
  const reservedTokens = reservedInputTokens + prepared.maxOutputTokens;
  let lease: ReturnType<typeof aiUsageLimiter.acquire> | undefined;
  let usedTokens = reservedInputTokens;

  try {
    lease = aiUsageLimiter.acquire(req.ip ?? req.socket.remoteAddress ?? "unknown", reservedTokens);
    const result = await runAiServiceOperation(input, requestId, prepared);
    usedTokens = result.usage.estimatedTokens;
    res.json(result);
  } catch (error) {
    if (error instanceof AiLimitError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      res.status(429).json({ error: error.message, code: error.code, retryable: true });
      return;
    }
    if (error instanceof AiProviderError) {
      req.log.warn({ requestId, code: error.code }, "AI provider operation failed");
      res.status(error.status).json({ error: error.message, code: error.code, retryable: error.retryable });
      return;
    }
    if (error instanceof AiValidationError) {
      const invalidResponse = error.code === "AI_INVALID_RESPONSE";
      req.log.warn({ requestId, code: error.code }, "AI operation validation failed");
      res.status(invalidResponse ? 502 : 400).json({
        error: error.message,
        code: error.code,
        retryable: invalidResponse,
      });
      return;
    }
    req.log.error({ requestId, err: error }, "Unexpected AI operation failure");
    res.status(502).json({
      error: "AI could not complete the request.",
      code: "AI_OPERATION_FAILED",
      retryable: true,
    });
  } finally {
    lease?.release(usedTokens);
  }
});

export default router;
