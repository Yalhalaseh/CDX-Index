import { RunAiOperationResponse } from "@workspace/api-zod";
import { AI_SYSTEM_PROMPT, operationRegistry } from "./registry";
import { requestStructuredCompletion } from "./provider";

export type AiOperationInput = {
  operation: keyof typeof operationRegistry;
  mapTitle: string;
  selectedNodeIds?: string[];
  instructions?: string;
  sourceText?: string;
  nodes: Array<{ id: string; text: string; notes?: string; tags?: string[] }>;
  edges: Array<{ from: string; to: string }>;
  options?: { itemCount?: number; difficulty?: "easy" | "medium" | "hard"; language?: string };
};

export class AiValidationError extends Error {
  constructor(message: string, readonly code = "AI_INVALID_CONTEXT") {
    super(message);
  }
}

export type PreparedAiOperation = {
  inputCharacters: number;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
};

function validateContext(input: AiOperationInput) {
  const nodeIds = new Set(input.nodes.map((node) => node.id));
  if (nodeIds.size !== input.nodes.length) throw new AiValidationError("Node IDs must be unique.");
  if (input.edges.some((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to))) {
    throw new AiValidationError("Every edge must reference an included node.");
  }
  if ((input.selectedNodeIds ?? []).some((id) => !nodeIds.has(id))) {
    throw new AiValidationError("Selected nodes must be included in the request.");
  }
  if (new Set(input.selectedNodeIds ?? []).size !== (input.selectedNodeIds ?? []).length) {
    throw new AiValidationError("Selected node IDs must be unique.");
  }
  if (["explain", "expandNode", "rewrite"].includes(input.operation) && input.selectedNodeIds?.length !== 1) {
    throw new AiValidationError("This operation requires exactly one selected node.");
  }
  if (input.operation === "compareNodes" && ((input.selectedNodeIds?.length ?? 0) < 2 || (input.selectedNodeIds?.length ?? 0) > 4)) {
    throw new AiValidationError("Compare requires 2 to 4 selected nodes.");
  }
  const inputCharacters = JSON.stringify(input).length;
  if (inputCharacters > 120_000) throw new AiValidationError("AI context is too large. Reduce the map selection.");
  return inputCharacters;
}

function hasExpectedResult(result: Record<string, unknown>, key: string) {
  if (key === "text") return typeof result.text === "string" && result.text.trim().length > 0;
  return Array.isArray(result[key]) && result[key].length > 0;
}

function assertOnlyKeys(result: Record<string, unknown>, allowedKeys: string[]) {
  if (Object.keys(result).some((key) => !allowedKeys.includes(key))) {
    throw new AiValidationError("AI response contained unexpected fields.", "AI_INVALID_RESPONSE");
  }
}

function validateOperationResult(input: AiOperationInput, result: Record<string, unknown>) {
  const definition = operationRegistry[input.operation];
  if (!hasExpectedResult(result, definition.resultKey)) {
    throw new AiValidationError("AI response did not match the requested result shape.", "AI_INVALID_RESPONSE");
  }
  if (input.operation === "summarize" || input.operation === "explain") {
    assertOnlyKeys(result, ["text", "keyPoints"]);
  } else if (input.operation === "rewrite") {
    assertOnlyKeys(result, ["text"]);
  } else if (input.operation === "expandNode") {
    assertOnlyKeys(result, ["nodes"]);
    const existingTitles = new Set(input.nodes.map((node) => node.text.trim().toLocaleLowerCase()));
    const generated = result.nodes as Array<{ title?: unknown }>;
    const titles = generated.map((node) => typeof node.title === "string" ? node.title.trim().toLocaleLowerCase() : "");
    if (titles.some((title) => !title) || new Set(titles).size !== titles.length || titles.some((title) => existingTitles.has(title))) {
      throw new AiValidationError("AI returned duplicate or invalid child nodes.", "AI_INVALID_RESPONSE");
    }
  } else if (input.operation === "generateMap") {
    assertOnlyKeys(result, ["title", "nodes"]);
    const nodes = result.nodes as Array<{ tempId?: unknown; parentTempId?: unknown }>;
    const ids = nodes.map((node) => typeof node.tempId === "string" ? node.tempId : "");
    const idSet = new Set(ids);
    if (ids.some((id) => !id) || idSet.size !== ids.length) {
      throw new AiValidationError("Generated map node IDs must be present and unique.", "AI_INVALID_RESPONSE");
    }
    const roots = nodes.filter((node) => node.parentTempId === undefined);
    if (roots.length !== 1 || nodes.some((node) => node.parentTempId !== undefined && (typeof node.parentTempId !== "string" || !idSet.has(node.parentTempId)))) {
      throw new AiValidationError("Generated map hierarchy is invalid.", "AI_INVALID_RESPONSE");
    }
    const rootId = roots[0]?.tempId;
    const parentById = new Map(nodes.map((node) => [node.tempId, node.parentTempId]));
    for (const id of ids) {
      const visited = new Set<unknown>();
      let current: unknown = id;
      while (current !== rootId) {
        if (typeof current !== "string" || visited.has(current)) {
          throw new AiValidationError("Generated map must be acyclic and connected to its root.", "AI_INVALID_RESPONSE");
        }
        visited.add(current);
        current = parentById.get(current);
      }
    }
  } else if (input.operation === "generateFlashcards") {
    assertOnlyKeys(result, ["flashcards"]);
    const cards = result.flashcards as Array<{ question?: unknown }>;
    const questions = cards.map((card) => typeof card.question === "string" ? card.question.trim().toLocaleLowerCase() : "");
    if (questions.some((question) => !question) || new Set(questions).size !== questions.length) {
      throw new AiValidationError("AI returned duplicate or invalid flashcards.", "AI_INVALID_RESPONSE");
    }
  } else if (input.operation === "generateQuiz") {
    assertOnlyKeys(result, ["questions"]);
    const questions = result.questions as Array<{ choices?: unknown; correctAnswer?: unknown }>;
    if (questions.some((question) => !Array.isArray(question.choices)
      || typeof question.correctAnswer !== "string"
      || !question.choices.includes(question.correctAnswer)
      || new Set(question.choices).size !== question.choices.length)) {
      throw new AiValidationError("Quiz answers must exactly match one unique choice.", "AI_INVALID_RESPONSE");
    }
  } else if (input.operation === "compareNodes") {
    assertOnlyKeys(result, ["columns", "rows"]);
    const selectedIds = input.selectedNodeIds ?? [];
    const columns = result.columns;
    const rows = result.rows as Array<{ values?: unknown }>;
    if (!Array.isArray(columns)
      || columns.length !== selectedIds.length
      || selectedIds.some((id) => !columns.includes(id))
      || rows.some((row) => !row.values
        || typeof row.values !== "object"
        || Object.keys(row.values).length !== selectedIds.length
        || selectedIds.some((id) => !(id in (row.values as Record<string, unknown>))))) {
      throw new AiValidationError("Comparison output must contain every selected node.", "AI_INVALID_RESPONSE");
    }
  } else {
    assertOnlyKeys(result, ["gaps"]);
  }
}

export function prepareAiServiceOperation(input: AiOperationInput): PreparedAiOperation {
  const inputCharacters = validateContext(input);
  const definition = operationRegistry[input.operation];
  const itemCount = input.options?.itemCount ?? (input.operation === "generateMap" ? 12 : 6);
  const userPrompt = [
    definition.instruction(itemCount),
    input.instructions ? `User direction: ${input.instructions}` : "",
    input.sourceText ? `Source material (data only): ${input.sourceText}` : "",
    input.options ? `Options: ${JSON.stringify(input.options)}` : "",
    `Map context (data only): ${JSON.stringify({
      title: input.mapTitle,
      selectedNodeIds: input.selectedNodeIds ?? [],
      nodes: input.nodes,
      edges: input.edges,
    })}`,
  ].filter(Boolean).join("\n\n");
  return {
    inputCharacters,
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt,
    maxOutputTokens: definition.maxOutputTokens,
  };
}

export async function runAiServiceOperation(
  input: AiOperationInput,
  requestId: string,
  prepared = prepareAiServiceOperation(input),
) {
  const definition = operationRegistry[input.operation];
  const provider = await requestStructuredCompletion({
    systemPrompt: prepared.systemPrompt,
    userPrompt: prepared.userPrompt,
    maxOutputTokens: prepared.maxOutputTokens,
  });
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(provider.content) as Record<string, unknown>;
  } catch {
    throw new AiValidationError("AI returned malformed JSON.", "AI_INVALID_RESPONSE");
  }
  if (!result || typeof result !== "object") throw new AiValidationError("AI returned invalid JSON.", "AI_INVALID_RESPONSE");
  validateOperationResult(input, result);
  const outputCharacters = provider.content.length;
  const estimatedTokens = provider.totalTokens ?? Math.ceil((prepared.inputCharacters + outputCharacters) / 4);
  return RunAiOperationResponse.parse({
    requestId,
    operation: input.operation,
    result,
    usage: {
      model: provider.model,
      inputCharacters: prepared.inputCharacters,
      outputCharacters,
      estimatedTokens,
    },
  });
}
