import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { WordCard, type CardRole, type CardView } from "../card";
import type { PlayerView } from "../../engine";
import { useMessages } from "../../locale/useMessages";

interface BoardProps {
  view: PlayerView;
  votes: Record<string, number | null>;
  selectedCardIndex: number | null;
  onVote: (cardIndex: number) => void;
  onConfirm: (cardIndex: number) => void;
}

export function Board({
  view,
  votes,
  selectedCardIndex,
  onVote,
  onConfirm,
}: BoardProps) {
  const t = useMessages().play;
  const cardView: CardView =
    view.me?.role === "spymaster" || view.phase === "ended"
      ? "spymaster"
      : "operative";
  const voteCounts = countVotes(votes);

  // Guards against a second `confirmCard` mutation firing before the room
  // state confirms the first one landed (a fast double-tap otherwise hits a
  // version conflict on the server). Released once the board/guessesRemaining
  // reflect a fresh view, or the player taps a tile (same or different).
  const [pendingConfirmIndex, setPendingConfirmIndex] = useState<number | null>(
    null,
  );
  const lastResolved = useRef({
    board: view.board,
    guessesRemaining: view.guessesRemaining,
  });

  useEffect(() => {
    const moved =
      lastResolved.current.board !== view.board ||
      lastResolved.current.guessesRemaining !== view.guessesRemaining;
    if (moved) {
      setPendingConfirmIndex(null);
    }
    lastResolved.current = {
      board: view.board,
      guessesRemaining: view.guessesRemaining,
    };
  }, [view.board, view.guessesRemaining]);

  const handleVote = (index: number) => {
    setPendingConfirmIndex(null);
    onVote(index);
  };

  const handleConfirm = (index: number) => {
    if (pendingConfirmIndex === index) {
      return;
    }
    setPendingConfirmIndex(index);
    onConfirm(index);
  };

  return (
    <section aria-label={t.wordBoard} className="cn-board">
      {view.board.map((card, index) => {
        const role: CardRole = card.kind ?? "neutral";
        const voteCount = voteCounts[index] ?? 0;
        const confirmPending = pendingConfirmIndex === index;
        return (
          <div
            key={card.concept.id}
            className={cn(
              "cn-board__cell",
              selectedCardIndex === index && "is-selected",
            )}
          >
            {voteCount > 0 ? (
              <span className="cn-board__vote">{voteCount}</span>
            ) : null}
            {selectedCardIndex === index && view.can.guess && !card.revealed ? (
              <button
                type="button"
                className="cn-board__confirm"
                aria-label={t.revealCard}
                disabled={confirmPending}
                aria-busy={confirmPending}
                onClick={() => handleConfirm(index)}
              >
                ✓
              </button>
            ) : null}
            <WordCard
              word={card.concept[view.lang]}
              role={role}
              view={cardView}
              revealed={card.revealed}
              lang={view.lang}
              disabled={!view.can.guess || card.revealed}
              onClick={() => handleVote(index)}
              aria-label={card.concept[view.lang]}
            />
          </div>
        );
      })}
    </section>
  );
}

function countVotes(
  votes: Record<string, number | null>,
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const cardIndex of Object.values(votes)) {
    if (cardIndex !== null) {
      counts[cardIndex] = (counts[cardIndex] ?? 0) + 1;
    }
  }
  return counts;
}
