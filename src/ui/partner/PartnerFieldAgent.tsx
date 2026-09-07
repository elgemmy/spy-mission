import { useRef, useState } from "react";
import { Button } from "../components/Button";
import { FieldAgentBoard } from "./PartnerMissionBoard";
import {
  CurrentSignal,
  LockedGuessSummary,
  PartnerMissionHeader,
  PartnerStatus,
  PreviousTurn,
  RevealPresentation,
  WebMcpCapabilityIndicator,
} from "./PartnerMissionShared";
import { PARTNER_MESSAGES, DUO_MESSAGES } from "./strings";
import type {
  FieldAgentCard,
  PartnerMissionCommonProps,
  WebMcpCapability,
} from "./types";

export interface PartnerFieldAgentProps extends PartnerMissionCommonProps {
  cards: readonly FieldAgentCard[];
  capability: WebMcpCapability;
  onRetryWebMcp?: () => void;
  maxGuesses?: number | null;
  onLockGuesses?: (cardIds: string[]) => Promise<void>;
}

export function PartnerFieldAgent({
  partnerType,
  maxGuesses,
  onLockGuesses,
  locale,
  boardLang,
  phase,
  cards,
  targetsRemaining,
  fieldAgentName,
  signal,
  lockedCardIds,
  previousTurn,
  presentation,
  capability,
  onRetryWebMcp,
}: PartnerFieldAgentProps) {
  const words = new Map(cards.map((card) => [card.id, card.word]));
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const human = partnerType === "human";
  const selecting = human && phase === "field_agent_turn";
  const canSelect =
    selecting && !submitting && Boolean(maxGuesses) && Boolean(onLockGuesses);
  const displayedIds = selecting ? selected : lockedCardIds;
  const duo = DUO_MESSAGES[locale];

  const selectCard = (id: string) => {
    if (!canSelect || submittingRef.current) return;
    setSelected((current) =>
      current.includes(id)
        ? current.filter((cardId) => cardId !== id)
        : current.length < (maxGuesses ?? 0)
          ? [...current, id]
          : current,
    );
  };
  const lockGuesses = async () => {
    if (
      !canSelect ||
      submittingRef.current ||
      selected.length === 0 ||
      !onLockGuesses
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onLockGuesses([...selected]);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section
      className="cn-partner-screen"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-role="field-agent"
    >
      <PartnerMissionHeader
        partnerType={partnerType}
        locale={locale}
        role="agent"
        phase={phase}
        targetsRemaining={targetsRemaining}
      />
      {!human ? (
        <WebMcpCapabilityIndicator
          locale={locale}
          capability={capability}
          onRetry={onRetryWebMcp}
        />
      ) : null}
      <PartnerStatus
        partnerType={partnerType}
        locale={locale}
        phase={phase}
        fieldAgentName={fieldAgentName}
        lockedCount={lockedCardIds.length}
        previousTurn={previousTurn}
        presentation={presentation}
      />
      <CurrentSignal locale={locale} signal={signal} />
      {selecting ? <p className="cn-partner-muted">{duo.selectHint}</p> : null}
      <FieldAgentBoard
        cards={cards}
        locale={locale}
        boardLang={boardLang}
        lockedCardIds={displayedIds}
        onSelectCard={canSelect ? selectCard : undefined}
        selectionFull={selected.length >= (maxGuesses ?? 0)}
        activeRevealCardId={presentation?.activeCardId}
        revealSequenceCardIds={presentation?.sequenceCardIds}
        visibleRevealCount={presentation?.visibleRevealCount}
      />
      <LockedGuessSummary
        title={selecting ? duo.draftGuesses : undefined}
        locale={locale}
        cardIds={displayedIds}
        cardWords={words}
      />
      {selecting ? (
        <section className="cn-partner-panel">
          <p className="cn-partner-muted" role="status">
            {duo.selectionCount(selected.length, maxGuesses ?? 0)}
          </p>
          <div className="cn-partner-actions">
            <Button
              onClick={() => void lockGuesses()}
              disabled={!canSelect || selected.length === 0}
            >
              {submitting ? duo.locking : duo.lockGuesses}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelected([])}
              disabled={submitting || selected.length === 0}
            >
              {duo.clearSelection}
            </Button>
          </div>
        </section>
      ) : null}
      {phase === "locked" ? (
        <RevealPresentation
          locale={locale}
          fieldAgentName={fieldAgentName}
          presentation={presentation}
        />
      ) : null}
      <PreviousTurn locale={locale} turn={previousTurn} />
    </section>
  );
}

export function PartnerFieldAgentOnboarding({
  locale,
  capability,
  onRetryWebMcp,
}: {
  locale: "en" | "ar";
  capability: WebMcpCapability;
  onRetryWebMcp?: () => void;
}) {
  const t = PARTNER_MESSAGES[locale];

  return (
    <section
      className="cn-partner-screen cn-partner-onboarding"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-role="field-agent-onboarding"
    >
      <header className="cn-partner-onboarding__header">
        <p className="cn-partner-eyebrow">{t.partnerMission}</p>
        <h1 className="cn-partner-title">{t.fieldAgent}</h1>
        <p className="cn-partner-muted">{t.chooseNamePrompt}</p>
      </header>
      <WebMcpCapabilityIndicator
        locale={locale}
        capability={capability}
        onRetry={onRetryWebMcp}
      />
      {capability.state === "ready" ? (
        <p className="cn-partner-waiting" role="status">
          {t.waitingForAgentTool}
        </p>
      ) : null}
    </section>
  );
}
