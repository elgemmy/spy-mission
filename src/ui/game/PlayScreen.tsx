import { Board } from "./Board";
import { ClueBar } from "./ClueBar";
import { TopBar } from "./TopBar";
import { Button } from "../components/Button";
import { GlyphIcon } from "../card/glyphs";
import type { PlayerView, Role, Team } from "../../engine";
import type { ClueLogEntry, GameBanner, RoomRecord } from "../../room";

interface PlayScreenProps {
  room: RoomRecord;
  view: PlayerView;
  selectedCardIndex: number | null;
  isHost: boolean;
  clueToast: ClueLogEntry | null;
  onVote: (cardIndex: number) => void;
  onGiveClue: (word: string, count: number) => void;
  onConfirmGuess: (cardIndex: number) => void;
  onEndTurn: () => void;
  onReturnToLobby: () => void;
  onRegenerate: () => void;
}

export function PlayScreen({
  room,
  view,
  selectedCardIndex,
  isHost,
  clueToast,
  onVote,
  onGiveClue,
  onConfirmGuess,
  onEndTurn,
  onReturnToLobby,
  onRegenerate,
}: PlayScreenProps) {
  return (
    <>
      <BannerOverlay banners={room.ui.banners} />

      {clueToast ? (
        <div key={clueToast.id} className="cn-clue-toast" role="status">
          <p className="m-0 text-xs font-semibold">
            {clueToast.team === "red" ? "الأحمر" : "الأزرق"}
          </p>
          <p className="mt-cn-1 m-0 text-xl font-bold">{clueToast.clue.word}</p>
          <p className="mt-cn-1 m-0 font-mono text-sm">
            {formatCount(clueToast.clue.count)}
          </p>
        </div>
      ) : null}

      {isHost ? (
        <div className="cn-host-controls" aria-label="إدارة الجولة">
          <Button variant="secondary" onClick={onReturnToLobby}>
            الردهة
          </Button>
          <Button variant="secondary" onClick={onRegenerate}>
            لوحة جديدة
          </Button>
        </div>
      ) : null}

      <TopBar
        turn={view.turn}
        redRemaining={view.redRemaining}
        blueRemaining={view.blueRemaining}
        winner={view.winner}
      />
      <Board
        view={view}
        votes={room.ui.votes}
        selectedCardIndex={selectedCardIndex}
        onVote={onVote}
        onConfirm={onConfirmGuess}
      />

      <ClueHistory entries={room.ui.clueLog} />

      <TeamRoster view={view} />

      <ClueBar view={view} onGiveClue={onGiveClue} onEndTurn={onEndTurn} />
    </>
  );
}

function BannerOverlay({ banners }: { banners: GameBanner[] }) {
  const visible = visibleBanners(banners);
  if (visible.length === 0) {
    return null;
  }

  const hasAssassin = visible.some((banner) => banner.type === "assassin");

  return (
    <div className="cn-game-banner-stack" aria-live="assertive">
      {visible.map((banner) => (
        <article
          key={banner.id}
          className="cn-game-banner"
          data-type={banner.type}
          data-team={banner.type === "assassin" ? undefined : banner.team}
          data-sequence={
            banner.type === "win" && hasAssassin ? "after-assassin" : "now"
          }
        >
          <p className="m-0 text-xs font-semibold">{bannerTitle(banner)}</p>
          <p className="mt-cn-1 m-0 text-2xl font-bold">
            {bannerMessage(banner)}
          </p>
        </article>
      ))}
    </div>
  );
}

function visibleBanners(banners: GameBanner[]): GameBanner[] {
  const latest = banners.at(-1);
  const previous = banners.at(-2);
  if (!latest) {
    return [];
  }
  if (latest.type === "win" && previous?.type === "assassin") {
    return [previous, latest];
  }
  return [latest];
}

function bannerTitle(banner: GameBanner): string {
  if (banner.type === "assassin") {
    return "البطاقة السوداء";
  }
  if (banner.type === "win") {
    return "انتهت الجولة";
  }
  return "الدور الآن";
}

function bannerMessage(banner: GameBanner): string {
  if (banner.type === "assassin") {
    return `${teamLabel(banner.losingTeam)} خسر`;
  }
  if (banner.type === "win") {
    return `${teamLabel(banner.team)} فاز`;
  }
  return `دور ${teamLabel(banner.team)}`;
}

function ClueHistory({ entries }: { entries: ClueLogEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="cn-card-panel p-cn-3" aria-label="سجل التلميحات">
      <p className="text-ink-soft m-0 text-xs font-semibold">سجل التلميحات</p>
      <ol className="mt-cn-2 gap-cn-2 m-0 flex list-none flex-col p-0">
        {entries.slice(-5).map((entry) => (
          <li
            key={entry.id}
            className="gap-cn-3 flex items-center justify-between text-sm"
          >
            <span className="text-ink font-semibold">
              {entry.team === "red" ? "الأحمر" : "الأزرق"} · {entry.clue.word}
            </span>
            <span className="text-ink-soft font-mono">
              {formatCount(entry.clue.count)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TeamRoster({ view }: { view: PlayerView }) {
  return (
    <section className="cn-team-roster" aria-label="قوائم الفرق">
      <RosterTeam team="red" view={view} />
      <RosterTeam team="blue" view={view} />
    </section>
  );
}

function RosterTeam({ team, view }: { team: Team; view: PlayerView }) {
  const players = view.players.filter((player) => player.team === team);

  return (
    <article className="cn-team-roster__team" data-team={team}>
      <header className="cn-team-roster__header">
        <span className="cn-team-roster__title">
          <GlyphIcon role={team} />
          {teamLabel(team)}
        </span>
        <span className="cn-team-roster__count">{players.length}</span>
      </header>
      <ul className="cn-team-roster__list">
        {players.map((player) => (
          <li
            key={player.id}
            className="cn-team-roster__player"
            data-active={String(player.id === view.me?.id)}
          >
            <span className="cn-team-roster__name">{player.name}</span>
            <span className="cn-team-roster__role">
              {roleLabel(player.role)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function roleLabel(role: Role): string {
  return role === "spymaster" ? "قائد" : "لاعب";
}

function teamLabel(team: "red" | "blue"): string {
  return team === "red" ? "الأحمر" : "الأزرق";
}

function formatCount(count: number): string {
  return count === 0 ? "∞" : String(count);
}
