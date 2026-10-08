import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import type { PlayerView } from "../../engine";
import { useMessages } from "../../locale/useMessages";

interface ClueBarProps {
  view: PlayerView;
  onGiveClue: (word: string, count: number) => void;
  onEndTurn: () => void;
}

export function ClueBar({ view, onGiveClue, onEndTurn }: ClueBarProps) {
  const t = useMessages().play;
  const disabled = !view.can.giveClue && !view.can.guess && !view.clue;

  return (
    <section
      className="cn-cluebar"
      data-disabled={String(disabled)}
      aria-label={t.signal}
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
  const t = useMessages().play;
  const [word, setWord] = useState("");
  const [count, setCount] = useState("1");
  const [pending, setPending] = useState(false);
  const lastView = useRef(view);

  // The room state, not the submit handler, confirms the Signal was
  // accepted: clear the field only once `can.giveClue` flips false (the
  // clue phase has ended), so a rejected mutation leaves the typed word
  // intact. A fresh `view` (any new snapshot — success or a post-failure
  // refresh) also releases the Send guard below.
  useEffect(() => {
    if (lastView.current !== view) {
      if (lastView.current.can.giveClue && !view.can.giveClue) {
        setWord("");
      }
      setPending(false);
      lastView.current = view;
    }
  }, [view]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!view.can.giveClue || word.trim().length === 0 || pending) {
      return;
    }
    setPending(true);
    onGiveClue(word, Number(count));
  };

  return (
    <form className="gap-cn-3 flex flex-col" onSubmit={submit}>
      <div>
        <p className="text-ink-soft m-0 text-xs font-semibold">
          {t.giveSignal}
        </p>
        <p className="mt-cn-1 text-ink m-0 text-sm font-semibold">
          {view.can.giveClue ? t.yourTeamTurn : t.waitTeamTurn}
        </p>
      </div>
      <div className="cn-clue-form-grid">
        <div>
          <label className="cn-sr-only" htmlFor="signal-text">
            {t.signalText}
          </label>
          <input
            id="signal-text"
            className="cn-field"
            value={word}
            onChange={(event) => {
              setWord(event.target.value);
              setPending(false);
            }}
            disabled={!view.can.giveClue}
            placeholder={t.signalText}
          />
        </div>
        <div>
          <label className="cn-sr-only" htmlFor="signal-count">
            {t.guessCount}
          </label>
          <select
            id="signal-count"
            className="cn-field font-mono"
            value={count}
            onChange={(event) => {
              setCount(event.target.value);
              setPending(false);
            }}
            disabled={!view.can.giveClue}
          >
            <option value="0">∞</option>
            {Array.from({ length: 9 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        className="cn-clue-submit w-full"
        data-team={view.turn}
        disabled={!view.can.giveClue || word.trim().length === 0 || pending}
        aria-busy={pending}
        type="submit"
      >
        {t.send}
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
  const t = useMessages().play;
  return (
    <div className="gap-cn-3 flex flex-col">
      <div className="gap-cn-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-ink-soft m-0 text-xs font-semibold">{t.signal}</p>
          <p className="cn-clue-word mt-cn-1 text-ink m-0">
            {view.clue?.word ?? t.waitingSignal}
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
          {t.endTurn}
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
