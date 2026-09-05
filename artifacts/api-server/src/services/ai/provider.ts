const MODEL = "gpt-5.4-mini";
const REQUEST_TIMEOUT_MS = 35_000;
const PROVIDER_ATTEMPTS = 2;

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

type ProviderResult = {
  content: string;
  totalTokens?: number;
  model: string;
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestStructuredCompletion(input: {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}): Promise<ProviderResult> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new AiProviderError("AI is not configured.", "AI_NOT_CONFIGURED", 503, false);
  }

  for (let attempt = 0; attempt < PROVIDER_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_completion_tokens: input.maxOutputTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < PROVIDER_ATTEMPTS - 1) {
          await wait(500 * (attempt + 1));
          continue;
        }
        throw new AiProviderError("AI provider could not complete the request.", "AI_PROVIDER_ERROR", 502, retryable);
      }
      const data = await response.json() as {
        model?: string;
        usage?: { total_tokens?: number };
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new AiProviderError("AI returned an empty response.", "AI_EMPTY_RESPONSE", 502, true);
      return { content, totalTokens: data.usage?.total_tokens, model: data.model ?? MODEL };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      if (attempt < PROVIDER_ATTEMPTS - 1) {
        await wait(500 * (attempt + 1));
        continue;
      }
      throw new AiProviderError(
        timedOut ? "AI request timed out." : "AI provider request failed.",
        timedOut ? "AI_TIMEOUT" : "AI_NETWORK_ERROR",
        502,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new AiProviderError("AI provider request failed.", "AI_PROVIDER_ERROR", 502, true);
}
