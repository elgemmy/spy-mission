import { GlyphIcon } from "../card/glyphs";
import type { Team } from "../../engine";

interface TopBarProps {
  turn: Team;
  redRemaining: number;
  blueRemaining: number;
  winner: Team | null;
}

const TEAM_LABEL: Record<Team, string> = {
  red: "الأحمر",
  blue: "الأزرق",
};

export function TopBar({
  turn,
  redRemaining,
  blueRemaining,
  winner,
}: TopBarProps) {
  if (winner) {
    return (
      <div className="cn-winner-panel p-cn-4 text-center" data-team={winner}>
        <p className="m-0 text-xs font-semibold">انتهت الجولة</p>
        <p className="mt-cn-1 m-0 text-lg font-bold">
          فاز الفريق {TEAM_LABEL[winner]}
        </p>
      </div>
    );
  }

  return (
    <div className="cn-topbar cn-card-panel" aria-label="حالة الدور">
      <CountChip team="red" count={redRemaining} active={turn === "red"} />
      <div className="cn-turn">
        <span className="cn-turn__eyebrow">الدور الآن</span>
        <span className="cn-turn__team" data-team={turn}>
          {TEAM_LABEL[turn]}
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
