import { Button } from "../components/Button";
import { GlyphIcon } from "../card/glyphs";
import { PARTNER_MESSAGES } from "./strings";
import type {
  PartnerMissionPhase,
  PartnerPreviousTurn,
  PartnerRevealPresentation,
  PartnerSignal,
  WebMcpCapability,
} from "./types";

export function PartnerMissionHeader({
  locale,
  role,
  phase,
  targetsRemaining,
}: {
  locale: "en" | "ar";
  role: "lead" | "agent";
  phase: PartnerMissionPhase;
  targetsRemaining: number;
}) {
  const t = PARTNER_MESSAGES[locale];

  return (
    <header className="cn-partner-header">
      <div className="cn-partner-header__identity">
        <p className="cn-partner-eyebrow">{t.partnerMission}</p>
        <h1 className="cn-partner-title">
          {role === "lead" ? t.missionLead : t.fieldAgent}
        </h1>
        <p className="cn-partner-phase">{t.phaseLabel(phase)}</p>
      </div>
      <div className="cn-partner-targets" aria-label={t.targetCount}>
        <GlyphIcon role="red" />
        <span className="cn-partner-targets__count">{targetsRemaining}</span>
        <span className="cn-partner-targets__label">{t.targetsRemaining}</span>
      </div>
    </header>
  );
}

export function PartnerStatus({
  locale,
  phase,
  fieldAgentName,
  lockedCount,
  previousTurn,
  presentation,
}: {
  locale: "en" | "ar";
  phase: PartnerMissionPhase;
  fieldAgentName: string | null;
  lockedCount: number;
  previousTurn?: PartnerPreviousTurn | null;
  presentation?: PartnerRevealPresentation;
}) {
  const t = PARTNER_MESSAGES[locale];
  const status = currentStatus({
    t,
    phase,
    fieldAgentName,
    lockedCount,
    previousTurn,
    presentation,
  });

  return (
    <p className="cn-partner-status" aria-label={t.activity} aria-live="polite">
      <span
        className="cn-partner-status__dot"
        data-ready={String(fieldAgentName !== null)}
        aria-hidden="true"
      />
      <strong>{status}</strong>
    </p>
  );
}

export function CurrentSignal({
  locale,
  signal,
}: {
  locale: "en" | "ar";
  signal: PartnerSignal | null;
}) {
  const t = PARTNER_MESSAGES[locale];

  return (
    <section className="cn-partner-signal" aria-label={t.signal}>
      <div>
        <p className="cn-partner-eyebrow">{t.signal}</p>
        <p className="cn-partner-signal__word">{signal?.word ?? t.noSignal}</p>
      </div>
      <span className="cn-partner-count" aria-label={t.guessCount}>
        {signal?.count ?? "–"}
      </span>
    </section>
  );
}

export function LockedGuessSummary({
  locale,
  cardIds,
  cardWords,
}: {
  locale: "en" | "ar";
  cardIds: readonly string[];
  cardWords: ReadonlyMap<string, string>;
}) {
  const t = PARTNER_MESSAGES[locale];

  return (
    <section
      className="cn-partner-panel"
      aria-labelledby="locked-guesses-title"
    >
      <p id="locked-guesses-title" className="cn-partner-eyebrow">
        {t.orderedGuesses}
      </p>
      {cardIds.length === 0 ? (
        <p className="cn-partner-muted">{t.noGuesses}</p>
      ) : (
        <ol className="cn-partner-guess-list">
          {cardIds.map((id, index) => (
            <li key={id}>
              <span className="cn-partner-order-inline">{index + 1}</span>
              <span>{cardWords.get(id) ?? id}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RevealPresentation({
  locale,
  fieldAgentName,
  presentation,
  onRevealNow,
}: {
  locale: "en" | "ar";
  fieldAgentName: string | null;
  presentation?: PartnerRevealPresentation;
  onRevealNow?: () => void;
}) {
  const t = PARTNER_MESSAGES[locale];
  const countdown = presentation?.countdownSeconds;
  const progress = presentation?.step;

  if (countdown === undefined && progress === undefined && !onRevealNow) {
    return null;
  }

  return (
    <section className="cn-partner-reveal" aria-live="assertive">
      <p className="cn-partner-reveal__message">
        {progress
          ? t.revealProgress(progress.current, progress.total)
          : countdown !== undefined
            ? t.revealCountdown(countdown)
            : t.revealingGuesses(fieldAgentName ?? t.fieldAgent)}
      </p>
      {onRevealNow ? (
        <Button variant="secondary" onClick={onRevealNow}>
          {t.revealNow}
        </Button>
      ) : null}
    </section>
  );
}

export function PreviousTurn({
  locale,
  turn,
}: {
  locale: "en" | "ar";
  turn?: PartnerPreviousTurn | null;
}) {
  const t = PARTNER_MESSAGES[locale];
  if (!turn) {
    return null;
  }

  return (
    <section className="cn-partner-panel" aria-labelledby="previous-turn-title">
      <div className="cn-partner-section-heading">
        <div>
          <p id="previous-turn-title" className="cn-partner-eyebrow">
            {t.previousTurn}
          </p>
          <strong>{turn.signal.word}</strong>
        </div>
        <span className="cn-partner-count">{turn.signal.count}</span>
      </div>
      {turn.reveals.length === 0 ? (
        <p className="cn-partner-muted">{t.noCardsRevealed}</p>
      ) : (
        <ol className="cn-partner-result-list">
          {turn.reveals.map((reveal) => (
            <li key={reveal.cardId} data-result={reveal.result}>
              <GlyphIcon role={roleForResult(reveal.result)} />
              <span>{reveal.word}</span>
              <strong>{t.resultLabel(reveal.result)}</strong>
            </li>
          ))}
        </ol>
      )}
      {turn.fieldNote ? (
        <div className="cn-partner-note">
          <p className="cn-partner-eyebrow">{t.fieldNote}</p>
          <p>{turn.fieldNote}</p>
        </div>
      ) : null}
    </section>
  );
}

export function WebMcpCapabilityIndicator({
  locale,
  capability,
  onRetry,
}: {
  locale: "en" | "ar";
  capability: WebMcpCapability;
  onRetry?: () => void;
}) {
  const t = PARTNER_MESSAGES[locale];
  const isReady = capability.state === "ready";
  const title =
    capability.state === "ready"
      ? t.webMcpReady
      : capability.state === "checking"
        ? t.webMcpChecking
        : capability.state === "error"
          ? t.webMcpError
          : t.webMcpUnavailable;

  return (
    <aside
      className="cn-partner-capability"
      data-state={capability.state}
      role="status"
    >
      <span
        className="cn-partner-status__dot"
        data-ready={String(isReady)}
        aria-hidden="true"
      />
      <div>
        <strong>{title}</strong>
        {isReady ? (
          <p>{t.toolsAvailable(capability.toolCount)}</p>
        ) : (
          <p>{t.webMcpRequired}</p>
        )}
      </div>
      {capability.state === "error" && onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t.retry}
        </Button>
      ) : null}
    </aside>
  );
}

function currentStatus({
  t,
  phase,
  fieldAgentName,
  lockedCount,
  previousTurn,
  presentation,
}: {
  t: PartnerMissionMessagesLike;
  phase: PartnerMissionPhase;
  fieldAgentName: string | null;
  lockedCount: number;
  previousTurn?: PartnerPreviousTurn | null;
  presentation?: PartnerRevealPresentation;
}): string {
  if (phase === "waiting_for_agent" || !fieldAgentName) {
    return t.waitingForPartner;
  }
  if (phase === "waiting_for_signal") {
    return previousTurn
      ? t.waitingForNextSignal(fieldAgentName)
      : t.waitingForSignal(fieldAgentName);
  }
  if (phase === "field_agent_turn") {
    return t.signalTransmitted;
  }
  if (phase === "locked") {
    return presentation?.countdownSeconds !== undefined ||
      presentation?.step !== undefined
      ? t.revealingGuesses(fieldAgentName)
      : t.guessesLocked(fieldAgentName, lockedCount);
  }
  return phase === "won" ? t.missionComplete : t.trapRevealed;
}

type PartnerMissionMessagesLike = Pick<
  (typeof PARTNER_MESSAGES)["en"],
  | "waitingForPartner"
  | "waitingForNextSignal"
  | "waitingForSignal"
  | "signalTransmitted"
  | "revealingGuesses"
  | "guessesLocked"
  | "missionComplete"
  | "trapRevealed"
>;

function roleForResult(result: "target" | "decoy" | "trap") {
  return result === "target"
    ? ("red" as const)
    : result === "trap"
      ? ("assassin" as const)
      : ("neutral" as const);
}
