import { GlyphIcon } from "../card/glyphs";
import type { Team } from "../../engine";
import { teamLabel } from "../../locale/messages";
import { useUiLocale } from "../../locale/uiLocale";
import { useMessages } from "../../locale/useMessages";

interface TopBarProps {
  turn: Team;
  redRemaining: number;
  blueRemaining: number;
  winner: Team | null;
}

export function TopBar({
  turn,
  redRemaining,
  blueRemaining,
  winner,
}: TopBarProps) {
  const { locale } = useUiLocale();
  const t = useMessages().play;

  if (winner) {
    return (
      <div className="cn-winner-panel p-cn-4 text-center" data-team={winner}>
        <p className="m-0 text-xs font-semibold">{t.roundOver}</p>
        <p className="mt-cn-1 m-0 text-lg font-bold">
          {t.winnerLine(teamLabel(locale, winner))}
        </p>
      </div>
    );
  }

  return (
    <div className="cn-topbar cn-card-panel" aria-label={t.turnStatus}>
      <CountChip team="red" count={redRemaining} active={turn === "red"} />
      <div className="cn-turn">
        <span className="cn-turn__eyebrow">{t.nowPlaying}</span>
        <span className="cn-turn__team" data-team={turn}>
          {teamLabel(locale, turn)}
        </span>
      </div>
      <CountChip team="blue" count={blueRemaining} active={turn === "blue"} />
    </div>
  );
}

function CountChip({
  team,
  count,
  active,
}: {
  team: Team;
  count: number;
  active: boolean;
}) {
  return (
    <span
      className="cn-count-chip"
      data-team={team}
      data-active={String(active)}
    >
      <GlyphIcon role={team} />
      <span>{count}</span>
    </span>
  );
}
