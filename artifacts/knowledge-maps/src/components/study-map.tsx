import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Brain, Check, ChevronRight, Eye, Minus, RotateCcw, X } from 'lucide-react';

type StudyNode = {
  id: string;
  text: string;
  masteryScore?: number;
  studyEnabled?: boolean;
  reviewSchedule?: StudySchedule;
  flashcards?: Array<{ id?: string; question?: string; answer?: string; reviewSchedule?: StudySchedule }>;
};

type StudySchedule = {
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  difficulty: number;
  mastery: number;
  interval: number;
};

type StudyEdge = {
  id: string;
  from: string;
  to: string;
};

export type StudyRating = 'again' | 'hard' | 'good' | 'easy';

type StudyQuestion = {
  id: string;
  nodeId: string;
  flashcardIndex?: number;
  type: 'hidden-node' | 'relationship' | 'flashcard' | 'reverse';
  eyebrow: string;
  context?: string;
  prompt: string;
  answer: string;
};

type StudyResult = {
  nodeId: string;
  nodeText: string;
  rating: StudyRating;
};

function createQuestions(nodes: StudyNode[], edges: StudyEdge[]): StudyQuestion[] {
  const enabledNodes = nodes.filter((node) => node.studyEnabled !== false);
  const enabledIds = new Set(enabledNodes.map((node) => node.id));
  const nodeById = new Map(enabledNodes.map((node) => [node.id, node]));
  const questions: StudyQuestion[] = [];
  const now = Date.now();
  const isDue = (schedule?: StudySchedule) => !schedule?.nextReviewAt || new Date(schedule.nextReviewAt).getTime() <= now;

  enabledNodes.forEach((node) => {
    const parentEdge = edges.find((edge) => edge.to === node.id && enabledIds.has(edge.from));
    const parent = parentEdge ? nodeById.get(parentEdge.from) : undefined;
    if (isDue(node.reviewSchedule)) {
      const reviewVariant = (node.reviewSchedule?.reviewCount ?? 0) % 3;
      const firstChildEdge = edges.find((edge) => edge.from === node.id && enabledIds.has(edge.to));
      const child = firstChildEdge ? nodeById.get(firstChildEdge.to) : undefined;
      if (reviewVariant === 1 && child) {
        questions.push({
          id: `relationship-${node.id}`,
          nodeId: node.id,
          type: 'relationship',
          eyebrow: 'Relationship recall',
          context: node.text,
          prompt: 'What is associated with this node?',
          answer: child.text,
        });
      } else if (reviewVariant === 2 && parent) {
        questions.push({
          id: `reverse-${node.id}`,
          nodeId: node.id,
          type: 'reverse',
          eyebrow: 'Reverse recall',
          context: node.text,
          prompt: 'What is the parent of this concept?',
          answer: parent.text,
        });
      } else {
        questions.push({
          id: `hidden-${node.id}`,
          nodeId: node.id,
          type: 'hidden-node',
          eyebrow: 'Hidden node',
          context: parent?.text ?? 'Map focus',
          prompt: 'What concept belongs here?',
          answer: node.text,
        });
      }
    }

    (node.flashcards ?? []).forEach((card, index) => {
      if (!card.question?.trim() || !card.answer?.trim() || !isDue(card.reviewSchedule)) return;
      questions.push({
        id: `flashcard-${node.id}-${card.id ?? index}`,
        nodeId: node.id,
        flashcardIndex: index,
        type: 'flashcard',
        eyebrow: 'Your flashcard',
        context: node.text,
        prompt: card.question.trim(),
        answer: card.answer.trim(),
      });
    });
  });

  return questions
    .sort((a, b) => {
      const aNode = nodeById.get(a.nodeId);
      const bNode = nodeById.get(b.nodeId);
      const aScore = a.flashcardIndex === undefined
        ? aNode?.reviewSchedule?.mastery ?? aNode?.masteryScore ?? 0
        : aNode?.flashcards?.[a.flashcardIndex]?.reviewSchedule?.mastery ?? 0;
      const bScore = b.flashcardIndex === undefined
        ? bNode?.reviewSchedule?.mastery ?? bNode?.masteryScore ?? 0
        : bNode?.flashcards?.[b.flashcardIndex]?.reviewSchedule?.mastery ?? 0;
      return aScore - bScore || a.id.localeCompare(b.id);
    })
    .slice(0, 24);
}

export function StudyMap({
  mapName,
  nodes,
  edges,
  onRate,
  onClose,
}: {
  mapName: string;
  nodes: StudyNode[];
  edges: StudyEdge[];
  onRate: (nodeId: string, flashcardIndex: number | undefined, rating: StudyRating) => void;
  onClose: () => void;
}) {
  const [questions] = useState(() => createQuestions(nodes, edges));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const question = questions[questionIndex];

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const rate = (rating: StudyRating) => {
    if (!question) return;
    onRate(question.nodeId, question.flashcardIndex, rating);
    setResults((current) => [
      ...current,
      {
        nodeId: question.nodeId,
        nodeText: nodeById.get(question.nodeId)?.text ?? 'Unknown concept',
        rating,
      },
    ]);
    if (questionIndex >= questions.length - 1) {
      setIsComplete(true);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setIsRevealed(false);
  };

  const correctCount = results.filter((result) => result.rating === 'good' || result.rating === 'easy').length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
  const improvedNodes = new Set(
    results.filter((result) => result.rating !== 'again').map((result) => result.nodeId),
  );
  const weakResults = results.filter((result) => result.rating === 'again' || result.rating === 'hard');
  const weakNodes = Array.from(new Map(weakResults.map((result) => [result.nodeId, result.nodeText])).values());
  const recommendation = weakNodes.length > 0
    ? 'Review weak concepts within 4 hours'
    : accuracy >= 80
      ? 'Review again in 3 days'
      : 'Review again tomorrow';

  if (typeof document === 'undefined') return null;

  return createPortal((
    <div className="study-map-shell" role="dialog" aria-modal="true" aria-label={`Study ${mapName}`} data-testid="study-map-mode">
      <header className="study-map-header">
        <button type="button" onClick={onClose} aria-label="Leave study mode">
          <ArrowLeft size={17} aria-hidden="true" />
          Exit
        </button>
        <div>
          <Brain size={16} aria-hidden="true" />
          <span>{mapName}</span>
        </div>
        {!isComplete ? <span>{Math.min(questionIndex + 1, questions.length)} / {questions.length}</span> : <span>Complete</span>}
      </header>

      {questions.length === 0 ? (
        <main className="study-map-empty">
          <Brain size={28} aria-hidden="true" />
          <h1>No study-enabled concepts</h1>
          <p>Enable at least one node for study to begin an active-recall session.</p>
          <button type="button" onClick={onClose}>Return to map</button>
        </main>
      ) : isComplete ? (
        <main className="study-map-summary" data-testid="study-map-summary">
          <p className="study-map-eyebrow">Session complete</p>
          <h1>Review complete</h1>
          <p>Your map stayed intact. Only concept mastery and review timing were updated.</p>
          <div className="study-summary-grid">
            <article><span>Questions completed</span><strong>{results.length}</strong></article>
            <article><span>Accuracy</span><strong>{accuracy}%</strong></article>
            <article><span>Concepts improved</span><strong>{improvedNodes.size}</strong></article>
            <article><span>Weak nodes</span><strong>{weakNodes.length}</strong></article>
          </div>
          <section className="study-recommendation">
            <span>Recommended next review</span>
            <strong>{recommendation}</strong>
            {weakNodes.length > 0 ? <p>Focus on {weakNodes.slice(0, 3).join(', ')}{weakNodes.length > 3 ? ` and ${weakNodes.length - 3} more` : ''}.</p> : null}
          </section>
          <button type="button" className="study-primary-action" onClick={onClose}>Return to map</button>
        </main>
      ) : (
        <main className="study-map-session">
          <div className="study-progress" aria-label={`${questionIndex} of ${questions.length} completed`}>
            <span style={{ width: `${(questionIndex / questions.length) * 100}%` }} />
          </div>
          <section className="study-question-card">
            <p className="study-map-eyebrow">{question.eyebrow}</p>
            {question.context ? <div className="study-question-context">{question.context}</div> : null}
            <h1>{question.prompt}</h1>
            <div className={`study-answer${isRevealed ? ' is-revealed' : ''}`} aria-live="polite">
              {isRevealed ? (
                <>
                  <span>Answer</span>
                  <strong>{question.answer}</strong>
                </>
              ) : (
                <button type="button" onClick={() => setIsRevealed(true)} data-testid="reveal-study-answer">
                  <Eye size={17} aria-hidden="true" />
                  Reveal Answer
                </button>
              )}
            </div>
          </section>
          <div className="study-rating-controls" aria-label="Rate your answer">
            <button type="button" className="is-incorrect" disabled={!isRevealed} onClick={() => rate('again')}>
              <RotateCcw size={16} aria-hidden="true" /> Again
            </button>
            <button type="button" className="is-almost" disabled={!isRevealed} onClick={() => rate('hard')}>
              <Minus size={16} aria-hidden="true" /> Hard
            </button>
            <button type="button" className="is-correct" disabled={!isRevealed} onClick={() => rate('good')}>
              <Check size={16} aria-hidden="true" /> Good
            </button>
            <button type="button" className="is-skip" disabled={!isRevealed} onClick={() => rate('easy')}>
              Easy <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </main>
      )}
    </div>
  ), document.body);
}
