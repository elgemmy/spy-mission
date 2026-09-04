import { useId, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { GlyphIcon } from "../card/glyphs";
import { MissionLeadBoard } from "./PartnerMissionBoard";
import {
  CurrentSignal,
  LockedGuessSummary,
  PartnerMissionHeader,
  PartnerStatus,
  PreviousTurn,
  RevealPresentation,
} from "./PartnerMissionShared";
import { PARTNER_MESSAGES } from "./strings";
import type { MissionLeadCard, PartnerMissionCommonProps } from "./types";

export interface PartnerMissionLeadProps extends PartnerMissionCommonProps {
  cards: readonly MissionLeadCard[];
  inviteUrl: string;
  inviteCopied?: boolean;
  briefingCopied?: boolean;
  onCopyAgentInvite: () => void;
  onCopyAgentBriefing: () => void;
  onSendSignal: (word: string, count: number) => void;
  onResolveLockedGuesses?: () => void;
  onNewMission?: () => void;
}

export function PartnerMissionLead({
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
  inviteUrl,
  inviteCopied = false,
  briefingCopied = false,
  onCopyAgentInvite,
  onCopyAgentBriefing,
  onSendSignal,
  onResolveLockedGuesses,
  onNewMission,
}: PartnerMissionLeadProps) {
  const words = new Map(cards.map((card) => [card.id, card.word]));
  const ended = phase === "won" || phase === "lost";

  return (
    <section
      className="cn-partner-screen"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-role="mission-lead"
    >
      <PartnerMissionHeader
        locale={locale}
        role="lead"
        phase={phase}
        targetsRemaining={targetsRemaining}
      />

      {ended ? (
        <MissionResult
          locale={locale}
          phase={phase}
          onNewMission={onNewMission}
        />
      ) : null}

      <PartnerStatus
        locale={locale}
        phase={phase}
        fieldAgentName={fieldAgentName}
        lockedCount={lockedCardIds.length}
        previousTurn={previousTurn}
        presentation={presentation}
      />

      {fieldAgentName === null ? (
        <AgentInvite
          locale={locale}
          inviteUrl={inviteUrl}
          inviteCopied={inviteCopied}
          briefingCopied={briefingCopied}
          onCopyAgentInvite={onCopyAgentInvite}
          onCopyAgentBriefing={onCopyAgentBriefing}
        />
      ) : null}

      <MissionLeadBoard
        cards={cards}
        locale={locale}
        boardLang={boardLang}
        lockedCardIds={lockedCardIds}
        activeRevealCardId={presentation?.activeCardId}
        revealSequenceCardIds={presentation?.sequenceCardIds}
        visibleRevealCount={presentation?.visibleRevealCount}
      />

      {signal ? <CurrentSignal locale={locale} signal={signal} /> : null}

      {!ended ? (
        <SignalForm
          locale={locale}
          enabled={phase === "waiting_for_signal"}
          onSendSignal={onSendSignal}
        />
      ) : null}

      {lockedCardIds.length > 0 ? (
        <LockedGuessSummary
          locale={locale}
          cardIds={lockedCardIds}
          cardWords={words}
        />
      ) : null}

      {phase === "locked" ? (
        <RevealPresentation
          locale={locale}
          fieldAgentName={fieldAgentName}
          presentation={presentation}
          onRevealNow={onResolveLockedGuesses}
        />
      ) : null}

      <PreviousTurn locale={locale} turn={previousTurn} />
    </section>
  );
}

function AgentInvite({
  locale,
  inviteUrl,
  inviteCopied,
  briefingCopied,
  onCopyAgentInvite,
  onCopyAgentBriefing,
}: {
  locale: "en" | "ar";
  inviteUrl: string;
  inviteCopied: boolean;
  briefingCopied: boolean;
  onCopyAgentInvite: () => void;
  onCopyAgentBriefing: () => void;
}) {
  const t = PARTNER_MESSAGES[locale];
  const inviteId = useId();

  return (
    <section className="cn-partner-panel" aria-labelledby={`${inviteId}-title`}>
      <div className="cn-partner-section-heading">
        <div>
          <p id={`${inviteId}-title`} className="cn-partner-eyebrow">
            {t.fieldAgentSeat}
          </p>
          <strong>{t.seatOpen}</strong>
        </div>
        <GlyphIcon role="neutral" />
      </div>
      <label className="cn-partner-label" htmlFor={inviteId}>
        {t.agentInvite}
      </label>
      <input
        id={inviteId}
        className="cn-partner-field cn-partner-invite"
        dir="ltr"
        value={inviteUrl}
        readOnly
      />
      <div className="cn-partner-actions">
        <Button variant="secondary" onClick={onCopyAgentInvite}>
          {inviteCopied ? t.inviteCopied : t.copyAgentInvite}
        </Button>
        <Button variant="secondary" onClick={onCopyAgentBriefing}>
          {briefingCopied ? t.briefingCopied : t.copyAgentBriefing}
        </Button>
      </div>
    </section>
  );
}

function SignalForm({
  locale,
  enabled,
  onSendSignal,
}: {
  locale: "en" | "ar";
  enabled: boolean;
  onSendSignal: (word: string, count: number) => void;
}) {
  const t = PARTNER_MESSAGES[locale];
  const signalId = useId();
  const countId = useId();
  const [word, setWord] = useState("");
  const [count, setCount] = useState("1");
  const normalizedWord = word.trim();
  const isOneWord = normalizedWord.length > 0 && !/\s/u.test(normalizedWord);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enabled || !isOneWord) {
      return;
    }
    onSendSignal(normalizedWord, Number(count));
    setWord("");
  };

  return (
    <form className="cn-partner-signal-form" onSubmit={submit}>
      <div className="cn-partner-signal-form__fields">
        <div>
          <label className="cn-partner-label" htmlFor={signalId}>
            {t.signalWord}
          </label>
          <input
            id={signalId}
            className="cn-partner-field"
            value={word}
            onChange={(event) => setWord(event.target.value)}
            disabled={!enabled}
            maxLength={40}
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label className="cn-partner-label" htmlFor={countId}>
            {t.guessCount}
          </label>
          <select
            id={countId}
            className="cn-partner-field cn-partner-count-field"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            disabled={!enabled}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={!enabled || !isOneWord}>
        {t.sendSignal}
      </Button>
    </form>
  );
}

function MissionResult({
  locale,
  phase,
  onNewMission,
}: {
  locale: "en" | "ar";
  phase: "won" | "lost";
  onNewMission?: () => void;
}) {
  const t = PARTNER_MESSAGES[locale];
  const won = phase === "won";

  return (
    <section
      className="cn-partner-result"
      data-result={phase}
      aria-live="assertive"
    >
      <GlyphIcon role={won ? "red" : "assassin"} />
      <strong>{won ? t.missionComplete : t.trapRevealed}</strong>
      {onNewMission ? (
        <Button variant="secondary" onClick={onNewMission}>
          {t.newMission}
        </Button>
      ) : null}
    </section>
  );
}
