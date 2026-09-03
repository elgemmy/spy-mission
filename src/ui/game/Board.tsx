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

  return (
    <section aria-label={t.wordBoard} className="cn-board">
      {view.board.map((card, index) => {
        const role: CardRole = card.kind ?? "neutral";
        const voteCount = voteCounts[index] ?? 0;
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
                onClick={() => onConfirm(index)}
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
              onClick={() => onVote(index)}
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
