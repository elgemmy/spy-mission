import { useId, useRef, useState } from "react";
import type { UiLocale } from "../../locale/uiLocale";
import type { HintView } from "../../room/hints";
import { Button } from "../components/Button";
import { HINT_MESSAGES } from "./strings";
import "./Hint.css";

interface HintControlProps {
  hint: HintView;
  locale: UiLocale;
  visible: boolean;
  onToggle: () => void;
  onRequestHint?: () => Promise<void>;
}

export function HintControl({
  hint,
  locale,
  visible,
  onToggle,
  onRequestHint,
}: HintControlProps) {
  const t = HINT_MESSAGES[locale];
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{
    turnId: string | null;
    message: "failed" | "notConfigured" | "unavailable";
  } | null>(null);
  const requesting = useRef(false);
  const [completedTurn, setCompletedTurn] = useState<string | null>(null);
  const hasScores = Boolean(hint.turnId && hint.scores);
  const awaitingSnapshot = Boolean(
    hint.turnId && completedTurn === hint.turnId && !hint.used,
  );
  const failed =
    failure !== null && failure.turnId === hint.turnId && !hint.used;
  const status = hint.used ? t.used : hint.canRequest ? t.available : t.waiting;

  const request = async () => {
    if (
      requesting.current ||
      awaitingSnapshot ||
      hint.used ||
      !hint.canRequest ||
      !onRequestHint
    ) {
      return;
    }
    requesting.current = true;
    setPending(true);
    setFailure(null);
    try {
      await onRequestHint();
      setCompletedTurn(hint.turnId);
    } catch (error) {
      // Errors are presented here so callers can reject without creating an
      // unhandled promise rejection or leaking server/provider error details.
      const code = error instanceof Error ? error.message : "";
      const message =
        code === "HINT_NOT_CONFIGURED"
          ? "notConfigured"
          : [
                "HINT_ALREADY_USED",
                "HINT_NOT_AVAILABLE",
                "HINT_STALE",
                "HINT_WRONG_ROLE",
              ].includes(code)
            ? "unavailable"
            : "failed";
      setFailure({ turnId: hint.turnId, message });
    } finally {
      requesting.current = false;
      setPending(false);
    }
  };

  return (
    <section
      className="cn-hint"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      aria-label={t.title}
      aria-busy={pending}
    >
      <div className="cn-hint__header">
        <div className="cn-hint__copy">
          <p className="cn-hint__title">{t.title}</p>
          <p className="cn-hint__status" id={descriptionId}>
            {status}
          </p>
        </div>
        {hasScores ? (
          <Button
            variant="secondary"
            onClick={onToggle}
            aria-pressed={visible}
            aria-describedby={descriptionId}
          >
            {visible ? t.hide : t.show}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void request()}
            disabled={
              pending ||
              awaitingSnapshot ||
              hint.used ||
              !hint.canRequest ||
              !onRequestHint
            }
            aria-describedby={descriptionId}
          >
            {pending || awaitingSnapshot ? t.loading : t.request}
          </Button>
        )}
      </div>
      {failed ? (
        <p className="cn-hint__error" role="alert">
          {t[failure.message]}
        </p>
      ) : null}
      {visible ? (
        <div className="cn-hint__legend">
          <p className="cn-hint__explanation">{t.explanation}</p>
          <div className="cn-hint__range">
            <span>{t.low}</span>
            <span className="cn-hint__scale" aria-hidden="true" />
            <span>{t.high}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
