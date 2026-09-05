import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, Eye, Minus, RotateCcw } from 'lucide-react';
import type { NodeFlashcard } from '@/App';
import type { StudyRating } from './study-map';

type StudyCard = {
  nodeId: string;
  nodeTitle: string;
  cardIndex: number;
  card: NodeFlashcard;
  imageUrl?: string;
};

export function FlashcardStudy({
  mapName,
  cards,
  onRate,
  onClose,
}: {
  mapName: string;
  cards: StudyCard[];
  onRate: (nodeId: string, cardIndex: number, rating: StudyRating) => void;
  onClose: () => void;
}) {
  const [queue] = useState(() => cards.filter(({ card }) =>
    !card.reviewSchedule?.nextReviewAt || new Date(card.reviewSchedule.nextReviewAt) <= new Date(),
  ).sort((a, b) =>
    (a.card.reviewSchedule?.mastery ?? 0) - (b.card.reviewSchedule?.mastery ?? 0),
  ));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<StudyRating[]>([]);
  const current = queue[index];

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const rate = (rating: StudyRating) => {
    if (!current) return;
    onRate(current.nodeId, current.cardIndex, rating);
    setRatings((value) => [...value, rating]);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  if (typeof document === 'undefined') return null;
  const complete = index >= queue.length;
  const successful = ratings.filter((rating) => rating === 'good' || rating === 'easy').length;

  return createPortal(
    <div className="study-map-shell flashcard-study-shell" role="dialog" aria-modal="true" aria-label={`Study flashcards for ${mapName}`} data-testid="flashcard-study-mode">
      <header className="study-map-header">
        <button type="button" onClick={onClose}><ArrowLeft size={17} /> Exit</button>
        <div><span>Flashcards · {mapName}</span></div>
        <span>{complete ? 'Complete' : `${index + 1} / ${queue.length}`}</span>
      </header>
      {queue.length === 0 ? (
        <main className="study-map-empty">
          <h1>No flashcards due</h1>
          <p>Your next scheduled cards will appear here automatically.</p>
          <button type="button" onClick={onClose}>Return to map</button>
        </main>
      ) : complete ? (
        <main className="study-map-summary">
          <p className="study-map-eyebrow">Flashcard session complete</p>
          <h1>Review complete</h1>
          <div className="study-summary-grid">
            <article><span>Cards reviewed</span><strong>{ratings.length}</strong></article>
            <article><span>Good or Easy</span><strong>{successful}</strong></article>
            <article><span>Needs review</span><strong>{ratings.filter((rating) => rating === 'again' || rating === 'hard').length}</strong></article>
            <article><span>Accuracy</span><strong>{ratings.length ? Math.round(successful / ratings.length * 100) : 0}%</strong></article>
          </div>
          <button type="button" className="study-primary-action" onClick={onClose}>Return to map</button>
        </main>
      ) : (
        <main className="study-map-session">
          <div className="study-progress"><span style={{ width: `${index / queue.length * 100}%` }} /></div>
          <section className="study-question-card flashcard-study-card">
            <p className="study-map-eyebrow">{current.nodeTitle}</p>
            {current.imageUrl ? <img src={current.imageUrl} alt={current.card.imageName ?? 'Flashcard'} /> : null}
            <h1>{current.card.question}</h1>
            <div className={`study-answer${revealed ? ' is-revealed' : ''}`}>
              {revealed ? (
                <>
                  <span>Answer</span>
                  <strong>{current.card.answer}</strong>
                  {current.card.explanation ? <p>{current.card.explanation}</p> : null}
                </>
              ) : (
                <button type="button" onClick={() => setRevealed(true)} data-testid="reveal-flashcard-answer"><Eye size={17} /> Reveal Answer</button>
              )}
            </div>
          </section>
          <div className="study-rating-controls">
            <button type="button" className="is-incorrect" disabled={!revealed} onClick={() => rate('again')}><RotateCcw size={16} /> Again</button>
            <button type="button" className="is-almost" disabled={!revealed} onClick={() => rate('hard')}><Minus size={16} /> Hard</button>
            <button type="button" className="is-correct" disabled={!revealed} onClick={() => rate('good')}><Check size={16} /> Good</button>
            <button type="button" className="is-skip" disabled={!revealed} onClick={() => rate('easy')}>Easy <ChevronRight size={16} /></button>
          </div>
        </main>
      )}
    </div>,
    document.body,
  );
}
