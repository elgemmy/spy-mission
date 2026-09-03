import { Button } from "../components/Button";
import { LocaleToggle } from "../components/LocaleToggle";
import { GlyphIcon } from "../card/glyphs";
import type { Lang, PlayerView, Role, Team } from "../../engine";
import { startReadiness } from "../../locale/startReadiness";
import { roleLabel, teamLabel } from "../../locale/messages";
import { useUiLocale } from "../../locale/uiLocale";
import { useMessages } from "../../locale/useMessages";
import type { RoomSnapshot, RoomVisibility } from "../../room";

interface LobbyProps {
  room: RoomSnapshot;
  view: PlayerView;
  playerId: string;
  copied: boolean;
  canCopyInvite: boolean;
  onCopyInvite: () => void;
  onSetLang: (lang: Lang) => void;
  onSetVisibility: (visibility: RoomVisibility) => void;
  onAssignSelf: (team: Team, role: Role) => void;
  onStartGame: () => void;
  onDeleteRoom: () => void;
  onLeaveRoom: () => void;
  onTransferHost: (nextHostId: string) => void;
  onBanPlayer: (targetPlayerId: string) => void;
}

export function Lobby({
  room,
  view,
  playerId,
  copied,
  canCopyInvite,
  onCopyInvite,
  onSetLang,
  onSetVisibility,
  onAssignSelf,
  onStartGame,
  onDeleteRoom,
  onLeaveRoom,
  onTransferHost,
  onBanPlayer,
}: LobbyProps) {
  const { locale } = useUiLocale();
  const t = useMessages().play;
  const isHost = room.hostId === playerId;
  const readiness = startReadiness(view, isHost);
  const startDisabled = !readiness.canStart;

  return (
    <>
      <header className="gap-cn-3 flex items-center justify-between">
        <div className="gap-cn-3 flex min-w-0 items-center">
          <div className="cn-wordmark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="min-w-0">
            <h1 className="text-ink m-0 text-lg font-bold">{t.productName}</h1>
            <p className="text-ink-soft m-0 text-xs font-semibold">
              {t.inRoom(view.players.length)}
            </p>
          </div>
        </div>
        <span className="rounded-chip bg-surface-2 px-cn-3 py-cn-2 text-ink-soft shrink-0 text-xs font-semibold">
          {isHost ? t.hostBadge : t.playerBadge}
        </span>
      </header>

      <section
        className="cn-card-panel p-cn-4 text-center"
        aria-label={t.roomCodeEyebrow}
      >
        <p className="text-ink-soft m-0 text-xs font-semibold">
          {t.roomCodeEyebrow}
        </p>
        <p className="cn-room-code mt-cn-1 m-0" dir="ltr">
          {room.code}
        </p>
        <Button
          className="mt-cn-3 w-full"
          variant="secondary"
          onClick={onCopyInvite}
          disabled={!canCopyInvite}
        >
          {copied ? t.copied : t.copyLink}
        </Button>
        <p className="mt-cn-2 text-ink-soft m-0 text-xs">
          {room.visibility === "public"
            ? t.publicRoomHint
            : canCopyInvite
              ? t.privateRoomHint
              : t.inviteUnavailable}
        </p>
      </section>

      <LocaleToggle />

      <section className="gap-cn-2 flex flex-col" aria-label={t.boardLanguage}>
        <div className="flex items-center justify-between">
          <span className="text-ink text-sm font-semibold">
            {t.boardLanguage}
          </span>
          <span className="text-ink-soft text-xs font-semibold">
            {view.lang === "ar" ? t.boardLanguageAr : t.boardLanguageEn}
          </span>
        </div>
        <div className="cn-segmented" dir="ltr">
          <button
            type="button"
            aria-pressed={view.lang === "en"}
            disabled={!isHost || !view.can.setLang}
            onClick={() => onSetLang("en")}
          >
            {t.boardLanguageEn}
          </button>
          <button
            type="button"
            aria-pressed={view.lang === "ar"}
            disabled={!isHost || !view.can.setLang}
            onClick={() => onSetLang("ar")}
          >
            {t.boardLanguageAr}
          </button>
        </div>
      </section>

      <section className="gap-cn-2 flex flex-col" aria-label={t.roomVisibility}>
        <div className="cn-segmented">
          <button
            type="button"
            aria-pressed={room.visibility === "public"}
            disabled={!isHost}
            onClick={() => onSetVisibility("public")}
          >
            {t.publicVisibility}
          </button>
          <button
            type="button"
            aria-pressed={room.visibility === "private"}
            disabled={!isHost}
            onClick={() => onSetVisibility("private")}
          >
            {t.privateVisibility}
          </button>
        </div>
      </section>

      <section className="gap-cn-3 grid grid-cols-2" aria-label={t.teams}>
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
        <Button
          disabled={startDisabled}
          onClick={onStartGame}
          aria-describedby={startDisabled ? "start-readiness" : undefined}
        >
          {t.startRound}
        </Button>
        {startDisabled ? (
          <p
            id="start-readiness"
            className="text-ink-soft m-0 text-sm font-semibold"
            role="status"
          >
            {readiness.missing.length > 0 ? t.startNeedSeats : null}
            {readiness.missing.length > 0 ? " " : null}
            {readiness.missing
              .map((seat) =>
                t.missingSeat(
                  teamLabel(locale, seat.team),
                  roleLabel(locale, seat.role),
                ),
              )
              .join(" · ")}
            {!isHost ? (
              <>
                {readiness.missing.length > 0 ? " " : null}
                {t.startNeedHost}
              </>
            ) : null}
          </p>
        ) : null}
        {isHost ? (
          <Button variant="secondary" onClick={onDeleteRoom}>
            {t.deleteRoom}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onLeaveRoom}>
            {t.leaveRoom}
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
  const { locale } = useUiLocale();
  const t = useMessages().play;
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
          {teamLabel(locale, team)}
        </span>
        <span className="text-ink-soft font-mono text-sm">
          {players.length}
        </span>
      </header>

      <div className="bg-surface-2 p-cn-2 rounded-sm">
        <p className="text-ink-soft m-0 text-xs font-semibold">
          {t.missionLead}
        </p>
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
            {t.joinMissionLead}
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
            {t.joinFieldAgent}
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
  const t = useMessages().play;
  return (
    <div className="cn-player-chip">
      <span className="cn-player-name">
        {active ? "• " : ""}
        {name}
        {host ? t.hostSuffix : ""}
      </span>
      {isHost && !host ? (
        <div className="cn-player-actions">
          <button
            type="button"
            className="cn-player-action"
            onClick={() => onTransferHost(id)}
          >
            {t.makeHost}
          </button>
          <button
            type="button"
            className="cn-player-action"
            onClick={() => onBanPlayer(id)}
          >
            {t.ban}
          </button>
        </div>
      ) : null}
    </div>
  );
}
