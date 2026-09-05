import {
  runAiOperation,
  type AiOperation,
  type AiOperationInput,
  type AiOperationResponse,
} from '@workspace/api-client-react';

export type AiOperationPayload = Omit<AiOperationInput, 'operation'>;

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 502, 503]);

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

function isRetryable(error: unknown) {
  const status = getErrorStatus(error);
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const data = error.data;
  return Boolean(data && typeof data === 'object' && 'retryable' in data && data.retryable === true);
}

function retryDelay(error: unknown, attempt: number) {
  if (error && typeof error === 'object' && 'headers' in error && error.headers instanceof Headers) {
    const retryAfter = Number(error.headers.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  }
  return 500 * 2 ** attempt;
}

function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('The AI request was cancelled.', 'AbortError'));
    }, { once: true });
  });
}

async function execute(
  operation: AiOperation,
  payload: AiOperationPayload,
  signal?: AbortSignal,
): Promise<AiOperationResponse> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runAiOperation({ ...payload, operation }, { signal });
    } catch (error) {
      if (signal?.aborted || !isRetryable(error) || attempt === MAX_ATTEMPTS - 1) throw error;
      await abortableDelay(retryDelay(error, attempt), signal);
    }
  }
  throw new Error('AI request failed.');
}

export function getAiErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'AI request cancelled.';
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return error instanceof Error ? error.message : 'AI request failed.';
}

export const aiService = {
  run: execute,
  summarize: (payload: AiOperationPayload, signal?: AbortSignal) => execute('summarize', payload, signal),
  explain: (payload: AiOperationPayload, signal?: AbortSignal) => execute('explain', payload, signal),
  expandNode: (payload: AiOperationPayload, signal?: AbortSignal) => execute('expandNode', payload, signal),
  generateMap: (payload: AiOperationPayload, signal?: AbortSignal) => execute('generateMap', payload, signal),
  generateFlashcards: (payload: AiOperationPayload, signal?: AbortSignal) => execute('generateFlashcards', payload, signal),
  generateQuiz: (payload: AiOperationPayload, signal?: AbortSignal) => execute('generateQuiz', payload, signal),
  compareNodes: (payload: AiOperationPayload, signal?: AbortSignal) => execute('compareNodes', payload, signal),
  detectKnowledgeGaps: (payload: AiOperationPayload, signal?: AbortSignal) => execute('detectKnowledgeGaps', payload, signal),
  rewrite: (payload: AiOperationPayload, signal?: AbortSignal) => execute('rewrite', payload, signal),
};
