import { Board } from "./Board";
import { ClueBar } from "./ClueBar";
import { TopBar } from "./TopBar";
import { Button } from "../components/Button";
import type { PlayerView } from "../../engine";
import type { ClueLogEntry, RoomRecord } from "../../room";

interface PlayScreenProps {
  room: RoomRecord;
  view: PlayerView;
  selectedCardIndex: number | null;
  isHost: boolean;
  clueToast: ClueLogEntry | null;
  onVote: (cardIndex: number) => void;
  onGiveClue: (word: string, count: number) => void;
  onConfirmGuess: () => void;
  onEndTurn: () => void;
  onReturnToLobby: () => void;
  onRegenerate: () => void;
}

export function PlayScreen({
  room,
  view,
  selectedCardIndex,
  isHost,
  clueToast,
  onVote,
  onGiveClue,
  onConfirmGuess,
  onEndTurn,
  onReturnToLobby,
  onRegenerate,
}: PlayScreenProps) {
  return (
    <>
      {clueToast ? (
        <div key={clueToast.id} className="cn-clue-toast" role="status">
          <p className="m-0 text-xs font-semibold">
            {clueToast.team === "red" ? "الأحمر" : "الأزرق"}
          </p>
          <p className="mt-cn-1 m-0 text-xl font-bold">{clueToast.clue.word}</p>
          <p className="mt-cn-1 m-0 font-mono text-sm">
            {formatCount(clueToast.clue.count)}
          </p>
        </div>
      ) : null}

      <TopBar
        turn={view.turn}
        redRemaining={view.redRemaining}
        blueRemaining={view.blueRemaining}
        winner={view.winner}
      />
      <Board
        view={view}
        votes={room.ui.votes}
        selectedCardIndex={selectedCardIndex}
        onVote={onVote}
      />

      {isHost ? (
        <div className="gap-cn-2 grid grid-cols-2">
          <Button variant="secondary" onClick={onReturnToLobby}>
            الردهة
          </Button>
          <Button variant="secondary" onClick={onRegenerate}>
            لوحة جديدة
          </Button>
        </div>
      ) : null}

      <ClueHistory entries={room.ui.clueLog} />

      <ClueBar
        view={view}
        selectedCardIndex={selectedCardIndex}
        onGiveClue={onGiveClue}
        onConfirmGuess={onConfirmGuess}
        onEndTurn={onEndTurn}
      />
    </>
  );
}

function ClueHistory({ entries }: { entries: ClueLogEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="cn-card-panel p-cn-3" aria-label="سجل التلميحات">
      <p className="text-ink-soft m-0 text-xs font-semibold">سجل التلميحات</p>
      <ol className="mt-cn-2 gap-cn-2 m-0 flex list-none flex-col p-0">
        {entries.slice(-5).map((entry) => (
          <li
            key={entry.id}
            className="gap-cn-3 flex items-center justify-between text-sm"
          >
            <span className="text-ink font-semibold">
              {entry.team === "red" ? "الأحمر" : "الأزرق"} · {entry.clue.word}
            </span>
            <span className="text-ink-soft font-mono">
              {formatCount(entry.clue.count)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatCount(count: number): string {
  return count === 0 ? "∞" : String(count);
}
