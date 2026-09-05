import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === "entity.too.large" || bodyError.status === 413) {
    res.status(413).json({ error: "Request body is too large.", code: "REQUEST_TOO_LARGE", retryable: false });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Request body is not valid JSON.", code: "INVALID_JSON", retryable: false });
    return;
  }
  req.log.error({ err: error }, "Unhandled API error");
  res.status(500).json({ error: "Internal server error.", code: "INTERNAL_ERROR", retryable: true });
};
app.use(errorHandler);

export default app;
