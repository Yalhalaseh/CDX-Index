import { Sparkles, Check, Minus } from 'lucide-react';
import type { AiOperationResponse } from '@workspace/api-client-react';

type AiReviewSidebarProps = {
  activeAction: string;
  operation: {
    isLoading: boolean;
    error?: string | null;
    data?: AiOperationResponse;
    cancel: () => void;
  };
  selectedItems: Set<string>;
  onToggleItem: (id: string, selected: boolean) => void;
  onAccept: () => void;
  onAcceptAll: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function AiReviewSidebar({
  activeAction,
  operation,
  selectedItems,
  onToggleItem,
  onAccept,
  onAcceptAll,
  onCancel,
  onRetry,
}: AiReviewSidebarProps) {
  const result = operation.data?.result;

  const renderContent = () => {
    if (operation.isLoading) {
      return (
        <div className="ai-tools-loading">
          <Sparkles className="animate-spin" size={24} />
          <p>AI is thinking...</p>
        </div>
      );
    }

    if (operation.error) {
      return (
        <div className="ai-tools-error" role="alert">
          <p>{operation.error}</p>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      );
    }

    if (!result) return null;

    if (activeAction === 'explain') {
      return (
        <div className="ai-review-content">
          <p>{result.text}</p>
          {result.keyPoints && (
            <ul>
              {result.keyPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (activeAction === 'expandNode' || activeAction === 'generateChildren') {
      const nodes = result.nodes ?? [];
      return (
        <div className="ai-review-list">
          {nodes.map((node) => {
            const id = node.tempId ?? node.title;
            return (
              <label key={id} className="ai-review-item">
                <input
                  type="checkbox"
                  checked={selectedItems.has(id)}
                  onChange={(e) => onToggleItem(id, e.target.checked)}
                />
                <div className="ai-item-details">
                  <strong>{node.title}</strong>
                  {node.description && <p>{node.description}</p>}
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    if (activeAction === 'generateFlashcards') {
      const cards = result.flashcards ?? [];
      return (
        <div className="ai-review-list">
          {cards.map((card, idx) => {
            const id = String(idx);
            return (
              <label key={id} className="ai-review-item">
                <input
                  type="checkbox"
                  checked={selectedItems.has(id)}
                  onChange={(e) => onToggleItem(id, e.target.checked)}
                />
                <div className="ai-item-details">
                  <strong>Q: {card.question}</strong>
                  <p>A: {card.answer}</p>
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    if (activeAction === 'generateQuiz') {
      const questions = result.questions ?? [];
      return (
        <div className="ai-review-list">
          {questions.map((q, idx) => {
            const id = String(idx);
            return (
              <label key={id} className="ai-review-item">
                <input
                  type="checkbox"
                  checked={selectedItems.has(id)}
                  onChange={(e) => onToggleItem(id, e.target.checked)}
                />
                <div className="ai-item-details">
                  <strong>{q.question}</strong>
                  <ul className="ai-quiz-choices">
                    {q.choices.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                  <p className="ai-quiz-answer">Answer: {q.correctAnswer}</p>
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    if (activeAction === 'simplify') {
      return (
        <div className="ai-review-list">
          <label className="ai-review-item">
            <input
              type="checkbox"
              checked={selectedItems.has('simplify')}
              onChange={(e) => onToggleItem('simplify', e.target.checked)}
            />
            <div className="ai-item-details">
              <strong>Simplified Note</strong>
              <p>{result.text}</p>
            </div>
          </label>
        </div>
      );
    }

    if (activeAction === 'addExamples') {
      const examples = result.keyPoints?.length ? result.keyPoints : result.text ? [result.text] : [];
      return (
        <div className="ai-review-list">
          {examples.map((ex, idx) => {
            const id = String(idx);
            return (
              <label key={id} className="ai-review-item">
                <input
                  type="checkbox"
                  checked={selectedItems.has(id)}
                  onChange={(e) => onToggleItem(id, e.target.checked)}
                />
                <div className="ai-item-details">
                  <p>{ex}</p>
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    if (activeAction === 'identifyMissing') {
      const gaps = result.gaps ?? [];
      return (
        <div className="ai-review-list">
          {gaps.map((gap, idx) => {
            const id = String(idx);
            return (
              <label key={id} className="ai-review-item">
                <input
                  type="checkbox"
                  checked={selectedItems.has(id)}
                  onChange={(e) => onToggleItem(id, e.target.checked)}
                />
                <div className="ai-item-details">
                  <strong>{gap.topic}</strong>
                  <p>{gap.reason}</p>
                  <span className="ai-gap-priority">Priority: {gap.priority}</span>
                </div>
              </label>
            );
          })}
        </div>
      );
    }

    return null;
  };

  const isExplain = activeAction === 'explain';
  const actionTitleMap: Record<string, string> = {
    explain: 'Explanation',
    expandNode: 'Expanded Nodes',
    generateChildren: 'Generated Children',
    generateFlashcards: 'Generated Flashcards',
    generateQuiz: 'Generated Quiz',
    simplify: 'Simplified Notes',
    addExamples: 'Examples',
    identifyMissing: 'Identified Gaps',
  };

  return (
    <aside className="ai-tools-panel" aria-label="AI tools review" data-testid="ai-tools-panel">
      <div className="ai-tools-heading">
        <div>
          <p>AI Review</p>
          <h2>{actionTitleMap[activeAction] || 'Suggestions'}</h2>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close AI tools">×</button>
      </div>

      <div className="ai-review-body">
        {renderContent()}
      </div>

      {result && !isExplain && (
        <div className="ai-tools-footer">
          <div className="ai-tools-actions">
            <button
              type="button"
              className="ai-btn-primary"
              disabled={selectedItems.size === 0}
              onClick={onAccept}
            >
              Accept Selected
            </button>
            <button
              type="button"
              className="ai-btn-secondary"
              onClick={onAcceptAll}
            >
              Accept All
            </button>
          </div>
          <button
            type="button"
            className="ai-btn-ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}
      
      {result && isExplain && (
        <div className="ai-tools-footer">
          <button
            type="button"
            className="ai-btn-ghost"
            onClick={onCancel}
          >
            Close
          </button>
        </div>
      )}
    </aside>
  );
}
