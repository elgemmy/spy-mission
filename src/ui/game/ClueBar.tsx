import { useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import type { PlayerView } from "../../engine";

interface ClueBarProps {
  view: PlayerView;
  onGiveClue: (word: string, count: number) => void;
  onEndTurn: () => void;
}

export function ClueBar({ view, onGiveClue, onEndTurn }: ClueBarProps) {
  const disabled = !view.can.giveClue && !view.can.guess && !view.clue;

  return (
    <section
      className="cn-cluebar"
      data-disabled={String(disabled)}
      aria-label="التلميح"
    >
      {view.me?.role === "spymaster" ? (
        <SpymasterClueForm view={view} onGiveClue={onGiveClue} />
      ) : (
        <OperativeCluePanel view={view} onEndTurn={onEndTurn} />
      )}
    </section>
  );
}

function SpymasterClueForm({
  view,
  onGiveClue,
}: {
  view: PlayerView;
  onGiveClue: (word: string, count: number) => void;
}) {
  const [word, setWord] = useState("");
  const [count, setCount] = useState("1");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!view.can.giveClue) {
      return;
    }
    onGiveClue(word, Number(count));
    setWord("");
  };

  return (
    <form className="gap-cn-3 flex flex-col" onSubmit={submit}>
      <div>
        <p className="text-ink-soft m-0 text-xs font-semibold">أعط تلميحا</p>
        <p className="mt-cn-1 text-ink m-0 text-sm font-semibold">
          {view.can.giveClue ? "دور فريقك" : "انتظر دور فريقك"}
        </p>
      </div>
      <div className="cn-clue-form-grid">
        <input
          className="cn-field"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          disabled={!view.can.giveClue}
          placeholder="نص التلميح"
          aria-label="التلميح"
        />
        <select
          className="cn-field font-mono"
          value={count}
          onChange={(event) => setCount(event.target.value)}
          disabled={!view.can.giveClue}
          aria-label="عدد التخمينات"
        >
          <option value="0">∞</option>
          {Array.from({ length: 9 }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
      </div>
      <Button
        className="cn-clue-submit w-full"
        data-team={view.turn}
        disabled={!view.can.giveClue || word.trim().length === 0}
        type="submit"
      >
        إرسال
      </Button>
    </form>
  );
}

function OperativeCluePanel({
  view,
  onEndTurn,
}: {
  view: PlayerView;
  onEndTurn: () => void;
}) {
  return (
    <div className="gap-cn-3 flex flex-col">
      <div className="gap-cn-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-ink-soft m-0 text-xs font-semibold">CLUE</p>
          <p className="cn-clue-word mt-cn-1 text-ink m-0">
            {view.clue?.word ?? "بانتظار التلميح"}
          </p>
        </div>
        <span className="rounded-chip bg-surface-2 px-cn-3 py-cn-2 text-ink font-mono text-sm">
          {formatGuesses(view.guessesRemaining)}
        </span>
      </div>
      <div className="gap-cn-2 flex flex-col">
        <Button
          variant="secondary"
          disabled={!view.can.endTurn}
          onClick={onEndTurn}
        >
          إنهاء الدور
        </Button>
      </div>
    </div>
  );
}

function formatGuesses(value: PlayerView["guessesRemaining"]): string {
  if (value === null) {
    return "-";
  }
  if (value === "unlimited") {
    return "∞";
  }
  return String(value);
}
