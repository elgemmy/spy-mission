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
import { PARTNER_MESSAGES } from "./strings";
import type {
  FieldAgentCard,
  PartnerMissionCommonProps,
  WebMcpCapability,
} from "./types";

export interface PartnerFieldAgentProps extends PartnerMissionCommonProps {
  cards: readonly FieldAgentCard[];
  capability: WebMcpCapability;
  onRetryWebMcp?: () => void;
}

export function PartnerFieldAgent({
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

  return (
    <section
      className="cn-partner-screen"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-role="field-agent"
    >
      <PartnerMissionHeader
        locale={locale}
        role="agent"
        phase={phase}
        targetsRemaining={targetsRemaining}
      />
      <WebMcpCapabilityIndicator
        locale={locale}
        capability={capability}
        onRetry={onRetryWebMcp}
      />
      <PartnerStatus
        locale={locale}
        phase={phase}
        fieldAgentName={fieldAgentName}
        lockedCount={lockedCardIds.length}
        previousTurn={previousTurn}
        presentation={presentation}
      />
      <CurrentSignal locale={locale} signal={signal} />
      <FieldAgentBoard
        cards={cards}
        locale={locale}
        boardLang={boardLang}
        lockedCardIds={lockedCardIds}
        activeRevealCardId={presentation?.activeCardId}
        revealSequenceCardIds={presentation?.sequenceCardIds}
        visibleRevealCount={presentation?.visibleRevealCount}
      />
      <LockedGuessSummary
        locale={locale}
        cardIds={lockedCardIds}
        cardWords={words}
      />
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
