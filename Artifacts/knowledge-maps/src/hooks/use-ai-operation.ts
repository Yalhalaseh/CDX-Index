import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AiOperation, AiOperationResponse } from '@workspace/api-client-react';
import { aiService, getAiErrorMessage, type AiOperationPayload } from '@/services/ai-service';

type AiMutationInput = {
  operation: AiOperation;
  payload: AiOperationPayload;
};

export function useAiOperation() {
  const controllerRef = useRef<AbortController | null>(null);
  const mutation = useMutation<AiOperationResponse, unknown, AiMutationInput>({
    mutationKey: ['ai-operation'],
    mutationFn: ({ operation, payload }) => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      return aiService.run(operation, payload, controllerRef.current.signal);
    },
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    execute: mutation.mutateAsync,
    cancel: () => controllerRef.current?.abort(),
    reset: mutation.reset,
    isLoading: mutation.isPending,
    error: mutation.error ? getAiErrorMessage(mutation.error) : '',
    data: mutation.data,
  };
}
