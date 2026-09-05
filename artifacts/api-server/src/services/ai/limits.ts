const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const DAILY_TOKEN_BUDGET = 100_000;
const MAX_GLOBAL_CONCURRENCY = 4;
const MAX_CLIENT_CONCURRENCY = 2;

type UsageRecord = {
  windowStartedAt: number;
  requestCount: number;
  day: string;
  estimatedTokens: number;
  active: number;
};

export class AiLimitError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

class AiUsageLimiter {
  private records = new Map<string, UsageRecord>();
  private activeGlobal = 0;

  acquire(clientId: string, reservedTokens: number) {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const record = this.records.get(clientId) ?? {
      windowStartedAt: now,
      requestCount: 0,
      day,
      estimatedTokens: 0,
      active: 0,
    };
    if (now - record.windowStartedAt >= WINDOW_MS) {
      record.windowStartedAt = now;
      record.requestCount = 0;
    }
    if (record.day !== day) {
      record.day = day;
      record.estimatedTokens = 0;
    }
    if (record.requestCount >= MAX_REQUESTS_PER_WINDOW) {
      throw new AiLimitError("AI request limit reached. Please wait before retrying.", "AI_RATE_LIMIT", Math.ceil((record.windowStartedAt + WINDOW_MS - now) / 1000));
    }
    if (record.estimatedTokens + reservedTokens > DAILY_TOKEN_BUDGET) {
      throw new AiLimitError("Daily AI usage limit reached.", "AI_DAILY_LIMIT", 3600);
    }
    if (record.active >= MAX_CLIENT_CONCURRENCY || this.activeGlobal >= MAX_GLOBAL_CONCURRENCY) {
      throw new AiLimitError("AI is busy. Please retry shortly.", "AI_CONCURRENCY_LIMIT", 2);
    }
    record.requestCount += 1;
    record.active += 1;
    record.estimatedTokens += reservedTokens;
    this.activeGlobal += 1;
    this.records.set(clientId, record);
    let released = false;
    return {
      release: (actualTokens: number) => {
        if (released) return;
        released = true;
        record.active = Math.max(0, record.active - 1);
        record.estimatedTokens = Math.max(0, record.estimatedTokens - reservedTokens + Math.max(0, actualTokens));
        this.activeGlobal = Math.max(0, this.activeGlobal - 1);
      },
    };
  }
}

export const aiUsageLimiter = new AiUsageLimiter();
