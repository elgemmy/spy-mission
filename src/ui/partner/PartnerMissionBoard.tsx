import { cn } from "../../lib/cn";
import { WordCard, type CardLang, type CardRole } from "../card";
import { PARTNER_MESSAGES } from "./strings";
import type { FieldAgentCard, MissionLeadCard, PartnerCardKind } from "./types";

interface BoardPresentationProps {
  locale: "en" | "ar";
  boardLang: CardLang;
  lockedCardIds: readonly string[];
  activeRevealCardId?: string;
  revealSequenceCardIds?: readonly string[];
  visibleRevealCount?: number;
}

export interface MissionLeadBoardProps extends BoardPresentationProps {
  cards: readonly MissionLeadCard[];
}

export interface FieldAgentBoardProps extends BoardPresentationProps {
  cards: readonly FieldAgentCard[];
}

const CARD_ROLE: Readonly<Record<PartnerCardKind, CardRole>> = {
  target: "red",
  decoy: "neutral",
  trap: "assassin",
};

export function MissionLeadBoard({
  cards,
  locale,
  boardLang,
  lockedCardIds,
  activeRevealCardId,
  revealSequenceCardIds,
  visibleRevealCount,
}: MissionLeadBoardProps) {
  const t = PARTNER_MESSAGES[locale];
  const orders = guessOrders(lockedCardIds);

  return (
    <section className="cn-partner-board" aria-label={t.missionMap}>
      {cards.map((card) => {
        const revealed = isPresentedAsRevealed(
          card.id,
          card.revealed,
          revealSequenceCardIds,
          visibleRevealCount,
        );
        return (
          <PartnerCardCell
            key={card.id}
            id={card.id}
            word={card.word}
            role={CARD_ROLE[card.kind]}
            view="spymaster"
            revealed={revealed}
            boardLang={boardLang}
            order={orders.get(card.id)}
            activeReveal={activeRevealCardId === card.id}
            ariaLabel={`${card.word}: ${t.resultLabel(card.kind)}`}
            orderLabel={t.guessOrder}
          />
        );
      })}
    </section>
  );
}

export function FieldAgentBoard({
  cards,
  locale,
  boardLang,
  lockedCardIds,
  activeRevealCardId,
  revealSequenceCardIds,
  visibleRevealCount,
}: FieldAgentBoardProps) {
  const t = PARTNER_MESSAGES[locale];
  const orders = guessOrders(lockedCardIds);

  return (
    <section className="cn-partner-board" aria-label={t.publicMissionBoard}>
      {cards.map((card) => {
        const revealed = isPresentedAsRevealed(
          card.id,
          card.revealed,
          revealSequenceCardIds,
          visibleRevealCount,
        );
        // Presentation masking applies to visual and accessible output alike.
        // The second check narrows the public union before result is read.
        const presentedResult = revealed && card.revealed ? card.result : null;
        const role = presentedResult ? CARD_ROLE[presentedResult] : "neutral";
        const ariaLabel = presentedResult
          ? `${card.word}: ${t.resultLabel(presentedResult)}`
          : card.word;

        return (
          <PartnerCardCell
            key={card.id}
            id={card.id}
            word={card.word}
            role={role}
            view="operative"
            revealed={revealed}
            boardLang={boardLang}
            order={orders.get(card.id)}
            activeReveal={activeRevealCardId === card.id}
            ariaLabel={ariaLabel}
            orderLabel={t.guessOrder}
          />
        );
      })}
    </section>
  );
}

function PartnerCardCell({
  id,
  word,
  role,
  view,
  revealed,
  boardLang,
  order,
  activeReveal,
  ariaLabel,
  orderLabel,
}: {
  id: string;
  word: string;
  role: CardRole;
  view: "operative" | "spymaster";
  revealed: boolean;
  boardLang: CardLang;
  order: number | undefined;
  activeReveal: boolean;
  ariaLabel: string;
  orderLabel: (order: number) => string;
}) {
  return (
    <div
      className={cn(
        "cn-partner-board__cell",
        order !== undefined && "is-locked",
        activeReveal && "is-revealing",
      )}
      data-card-id={id}
    >
      {order !== undefined ? (
        <span
          className="cn-partner-board__order"
          aria-label={orderLabel(order)}
        >
          {order}
        </span>
      ) : null}
      <WordCard
        word={word}
        role={role}
        view={view}
        revealed={revealed}
        lang={boardLang}
        disabled
        aria-label={ariaLabel}
      />
    </div>
  );
}

function guessOrders(ids: readonly string[]): ReadonlyMap<string, number> {
  return new Map(ids.map((id, index) => [id, index + 1]));
}

function isPresentedAsRevealed(
  cardId: string,
  authoritativeRevealed: boolean,
  sequenceCardIds: readonly string[] | undefined,
  visibleRevealCount: number | undefined,
): boolean {
  if (
    !authoritativeRevealed ||
    !sequenceCardIds ||
    visibleRevealCount === undefined
  ) {
    return authoritativeRevealed;
  }
  const sequenceIndex = sequenceCardIds.indexOf(cardId);
  return sequenceIndex < 0 || sequenceIndex < visibleRevealCount;
}
