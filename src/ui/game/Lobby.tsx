import { Button } from "../components/Button";
import { GlyphIcon } from "../card/glyphs";
import type { Lang, PlayerView, Role, Team } from "../../engine";
import type { RoomSnapshot, RoomVisibility } from "../../room";

interface LobbyProps {
  room: RoomSnapshot;
  view: PlayerView;
  playerId: string;
  copied: boolean;
  onCopyInvite: () => void;
  onRegenerateInvite: () => void;
  onSetLang: (lang: Lang) => void;
  onSetVisibility: (visibility: RoomVisibility) => void;
  onAssignSelf: (team: Team, role: Role) => void;
  onStartGame: () => void;
  onDeleteRoom: () => void;
  onLeaveRoom: () => void;
  onTransferHost: (nextHostId: string) => void;
  onBanPlayer: (targetPlayerId: string) => void;
}

const TEAM_LABEL: Record<Team, string> = {
  red: "الأحمر",
  blue: "الأزرق",
};

export function Lobby({
  room,
  view,
  playerId,
  copied,
  onCopyInvite,
  onRegenerateInvite,
  onSetLang,
  onSetVisibility,
  onAssignSelf,
  onStartGame,
  onDeleteRoom,
  onLeaveRoom,
  onTransferHost,
  onBanPlayer,
}: LobbyProps) {
  const isHost = room.hostId === playerId;

  return (
    <>
      <header className="gap-cn-3 flex items-center justify-between">
        <div className="gap-cn-3 flex items-center">
          <div className="cn-wordmark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1 className="text-ink m-0 text-lg font-bold">كودنيمز</h1>
            <p className="text-ink-soft m-0 text-xs font-semibold">
              {view.players.length} في الغرفة
            </p>
          </div>
        </div>
        <span className="rounded-chip bg-surface-2 px-cn-3 py-cn-2 text-ink-soft text-xs font-semibold">
          {isHost ? "المضيف" : "لاعب"}
        </span>
      </header>

      <section
        className="cn-card-panel p-cn-4 text-center"
        aria-label="رمز الغرفة"
      >
        <p className="text-ink-soft m-0 text-xs font-semibold">ROOM CODE</p>
        <p className="cn-room-code mt-cn-1 m-0" dir="ltr">
          {room.code}
        </p>
        <Button
          className="mt-cn-3 w-full"
          variant="secondary"
          onClick={onCopyInvite}
        >
          {copied ? "تم النسخ" : "نسخ الرابط"}
        </Button>
        <p className="mt-cn-2 text-ink-soft m-0 text-xs">
          {room.visibility === "public" ? "غرفة عامة بالرابط" : "غرفة خاصة"}
        </p>
      </section>

      <section className="gap-cn-2 flex flex-col" aria-label="لغة اللوحة">
        <div className="flex items-center justify-between">
          <span className="text-ink text-sm font-semibold">لغة اللوحة</span>
          <span className="text-ink-soft text-xs font-semibold">
            {view.lang === "ar" ? "العربية" : "English"}
          </span>
        </div>
        <div className="cn-segmented">
          <button
            type="button"
            aria-pressed={view.lang === "ar"}
            disabled={!isHost || !view.can.setLang}
            onClick={() => onSetLang("ar")}
          >
            العربية
          </button>
          <button
            type="button"
            aria-pressed={view.lang === "en"}
            disabled={!isHost || !view.can.setLang}
            onClick={() => onSetLang("en")}
          >
            English
          </button>
        </div>
        {isHost && room.visibility === "private" ? (
          <Button variant="secondary" onClick={onRegenerateInvite}>
            تجديد رابط الدعوة
          </Button>
        ) : null}
      </section>

      <section className="gap-cn-2 flex flex-col" aria-label="ظهور الغرفة">
        <div className="cn-segmented">
          <button
            type="button"
            aria-pressed={room.visibility === "public"}
            disabled={!isHost}
            onClick={() => onSetVisibility("public")}
          >
            عامة
          </button>
          <button
            type="button"
            aria-pressed={room.visibility === "private"}
            disabled={!isHost}
            onClick={() => onSetVisibility("private")}
          >
            خاصة
          </button>
        </div>
      </section>

      <section className="gap-cn-3 grid grid-cols-2" aria-label="الفرق">
        <TeamCard
          team="red"
          view={view}
          room={room}
          playerId={playerId}
          onAssignSelf={onAssignSelf}
          onTransferHost={onTransferHost}
          onBanPlayer={onBanPlayer}
        />
        <TeamCard
          team="blue"
          view={view}
          room={room}
          playerId={playerId}
          onAssignSelf={onAssignSelf}
          onTransferHost={onTransferHost}
          onBanPlayer={onBanPlayer}
        />
      </section>

      <div className="gap-cn-2 flex flex-col">
        <Button disabled={!isHost || !view.can.startGame} onClick={onStartGame}>
          بدء الجولة
        </Button>
        {isHost ? (
          <Button variant="secondary" onClick={onDeleteRoom}>
            حذف الغرفة
          </Button>
        ) : (
          <Button variant="secondary" onClick={onLeaveRoom}>
            مغادرة الغرفة نهائيا
          </Button>
        )}
      </div>
    </>
  );
}

function TeamCard({
  team,
  view,
  room,
  playerId,
  onAssignSelf,
  onTransferHost,
  onBanPlayer,
}: {
  team: Team;
  view: PlayerView;
  room: RoomSnapshot;
  playerId: string;
  onAssignSelf: (team: Team, role: Role) => void;
  onTransferHost: (nextHostId: string) => void;
  onBanPlayer: (targetPlayerId: string) => void;
}) {
  const isHost = room.hostId === playerId;
  const players = view.players.filter((player) => player.team === team);
  const spymasters = players.filter((player) => player.role === "spymaster");
  const operatives = players.filter((player) => player.role === "operative");
  const showSpymasterButton =
    view.can.assignSelf &&
    !(view.me?.team === team && view.me.role === "spymaster");
  const showOperativeButton =
    view.can.assignSelf &&
    !(view.me?.team === team && view.me.role === "operative");

  return (
    <article className="cn-team-card" data-team={team}>
      <header className="gap-cn-2 flex items-center justify-between">
        <span className="gap-cn-2 flex items-center text-sm font-bold">
          <GlyphIcon role={team} className="h-4 w-4" />
          {TEAM_LABEL[team]}
        </span>
        <span className="text-ink-soft font-mono text-sm">
          {players.length}
        </span>
      </header>

      <div className="bg-surface-2 p-cn-2 rounded-sm">
        <p className="text-ink-soft m-0 text-xs font-semibold">SPYMASTER</p>
        {spymasters.map((spymaster) => (
          <PlayerChip
            key={spymaster.id}
            id={spymaster.id}
            name={spymaster.name}
            active={spymaster.id === playerId}
            host={spymaster.id === room.hostId}
            isHost={isHost}
            onTransferHost={onTransferHost}
            onBanPlayer={onBanPlayer}
          />
        ))}
        {showSpymasterButton ? (
          <Button
            className="mt-cn-2 w-full"
            variant="secondary"
            onClick={() => onAssignSelf(team, "spymaster")}
          >
            انضم كقائد
          </Button>
        ) : null}
      </div>

      <div className="gap-cn-2 flex flex-col">
        {operatives.map((player) => (
          <PlayerChip
            key={player.id}
            id={player.id}
            name={player.name}
            active={player.id === playerId}
            host={player.id === room.hostId}
            isHost={isHost}
            onTransferHost={onTransferHost}
            onBanPlayer={onBanPlayer}
          />
        ))}
        {showOperativeButton ? (
          <Button
            variant="secondary"
            onClick={() => onAssignSelf(team, "operative")}
          >
            انضم كلاعب
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function PlayerChip({
  id,
  name,
  active,
  host,
  isHost,
  onTransferHost,
  onBanPlayer,
}: {
  id: string;
  name: string;
  active: boolean;
  host: boolean;
  isHost: boolean;
  onTransferHost: (nextHostId: string) => void;
  onBanPlayer: (targetPlayerId: string) => void;
}) {
  return (
    <div className="cn-player-chip">
      <span className="cn-player-name">
        {active ? "• " : ""}
        {name}
        {host ? " · مضيف" : ""}
      </span>
      {isHost && !host ? (
        <div className="cn-player-actions">
          <button
            type="button"
            className="cn-player-action"
            onClick={() => onTransferHost(id)}
          >
            جعله المضيف
          </button>
          <button
            type="button"
            className="cn-player-action"
            onClick={() => onBanPlayer(id)}
          >
            حظر
          </button>
        </div>
      ) : null}
    </div>
  );
}
