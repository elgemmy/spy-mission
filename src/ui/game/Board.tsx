import { cn } from "../../lib/cn";
import { WordCard, type CardRole, type CardView } from "../card";
import type { PlayerView } from "../../engine";

interface BoardProps {
  view: PlayerView;
  votes: Record<string, number | null>;
  selectedCardIndex: number | null;
  onVote: (cardIndex: number) => void;
}

export function Board({ view, votes, selectedCardIndex, onVote }: BoardProps) {
  const cardView: CardView =
    view.me?.role === "spymaster" ? "spymaster" : "operative";
  const voteCounts = countVotes(votes);

  return (
    <section aria-label="لوحة الكلمات" className="cn-board">
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
