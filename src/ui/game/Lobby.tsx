import { useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { GlyphIcon } from "../card/glyphs";
import type { Lang, PlayerView, Role, Team } from "../../engine";
import type { RoomRecord, RoomVisibility } from "../../room";

interface LobbyProps {
  room: RoomRecord;
  view: PlayerView;
  playerId: string;
  localPlayerIds: string[];
  copied: boolean;
  onCopyInvite: () => void;
  onSetLang: (lang: Lang) => void;
  onSetVisibility: (visibility: RoomVisibility) => void;
  onAssignSelf: (team: Team, role: Role) => void;
  onStartGame: () => void;
  onDeleteRoom: () => void;
  onTransferHost: (nextHostId: string) => void;
  onRemovePlayer: (targetPlayerId: string) => void;
  onSwitchPlayer: (nextPlayerId: string) => void;
  onAddLocalPlayer: (name: string) => void;
}

const TEAM_LABEL: Record<Team, string> = {
  red: "الأحمر",
  blue: "الأزرق",
};

export function Lobby({
  room,
  view,
  playerId,
  localPlayerIds,
  copied,
  onCopyInvite,
  onSetLang,
  onSetVisibility,
  onAssignSelf,
  onStartGame,
  onDeleteRoom,
  onTransferHost,
  onRemovePlayer,
  onSwitchPlayer,
  onAddLocalPlayer,
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
          localPlayerIds={localPlayerIds}
          onAssignSelf={onAssignSelf}
          onTransferHost={onTransferHost}
          onRemovePlayer={onRemovePlayer}
          onSwitchPlayer={onSwitchPlayer}
        />
        <TeamCard
          team="blue"
          view={view}
          room={room}
          playerId={playerId}
          localPlayerIds={localPlayerIds}
          onAssignSelf={onAssignSelf}
          onTransferHost={onTransferHost}
          onRemovePlayer={onRemovePlayer}
          onSwitchPlayer={onSwitchPlayer}
        />
      </section>

      <LocalPlayerForm onAddLocalPlayer={onAddLocalPlayer} />

      <div className="gap-cn-2 flex flex-col">
        <Button disabled={!isHost || !view.can.startGame} onClick={onStartGame}>
          بدء الجولة
        </Button>
        {isHost ? (
          <Button variant="secondary" onClick={onDeleteRoom}>
            حذف الغرفة
          </Button>
        ) : null}
      </div>
    </>
  );
}

function LocalPlayerForm({
  onAddLocalPlayer,
}: {
  onAddLocalPlayer: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    onAddLocalPlayer(trimmed);
    setName("");
  };

  return (
    <form
      className="cn-card-panel gap-cn-2 p-cn-3 flex flex-col"
      onSubmit={submit}
    >
      <label
        className="text-ink text-sm font-semibold"
        htmlFor="local-player-name"
      >
        لاعب محلي
      </label>
      <div className="gap-cn-2 grid grid-cols-2">
        <input
          id="local-player-name"
          className="cn-field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="الاسم"
        />
        <Button
          variant="secondary"
          type="submit"
          disabled={name.trim().length === 0}
        >
          إضافة
        </Button>
      </div>
    </form>
  );
}

function TeamCard({
  team,
  view,
  room,
  playerId,
  localPlayerIds,
  onAssignSelf,
  onTransferHost,
  onRemovePlayer,
  onSwitchPlayer,
}: {
  team: Team;
  view: PlayerView;
  room: RoomRecord;
  playerId: string;
  localPlayerIds: string[];
  onAssignSelf: (team: Team, role: Role) => void;
  onTransferHost: (nextHostId: string) => void;
  onRemovePlayer: (targetPlayerId: string) => void;
  onSwitchPlayer: (nextPlayerId: string) => void;
}) {
  const isHost = room.hostId === playerId;
  const players = view.players.filter((player) => player.team === team);
  const spymaster = players.find((player) => player.role === "spymaster");
  const operatives = players.filter((player) => player.role === "operative");

  return (
    <article className="cn-team-card" data-team={team}>
      <header className="gap-cn-2 flex items-center justify-between">
        <span className="gap-cn-2 text-ink flex items-center text-sm font-bold">
          <GlyphIcon role={team} className="h-4 w-4" />
          {TEAM_LABEL[team]}
        </span>
        <span className="text-ink-soft font-mono text-sm">
          {players.length}
        </span>
      </header>

      <div className="bg-surface-2 p-cn-2 rounded-sm">
        <p className="text-ink-soft m-0 text-xs font-semibold">SPYMASTER</p>
        {spymaster ? (
          <PlayerChip
            id={spymaster.id}
            name={spymaster.name}
            active={spymaster.id === playerId}
            switchable={localPlayerIds.includes(spymaster.id)}
            host={spymaster.id === room.hostId}
            isHost={isHost}
            onSwitchPlayer={onSwitchPlayer}
            onTransferHost={onTransferHost}
            onRemovePlayer={onRemovePlayer}
          />
        ) : (
          <Button
            className="mt-cn-2 w-full"
            variant="secondary"
            disabled={!view.can.assignSelf}
            onClick={() => onAssignSelf(team, "spymaster")}
          >
            انضم كقائد
          </Button>
        )}
      </div>

      <div className="gap-cn-2 flex flex-col">
        {operatives.map((player) => (
          <PlayerChip
            key={player.id}
            id={player.id}
            name={player.name}
            active={player.id === playerId}
            switchable={localPlayerIds.includes(player.id)}
            host={player.id === room.hostId}
            isHost={isHost}
            onSwitchPlayer={onSwitchPlayer}
            onTransferHost={onTransferHost}
            onRemovePlayer={onRemovePlayer}
          />
        ))}
        <Button
          variant="secondary"
          disabled={!view.can.assignSelf}
          onClick={() => onAssignSelf(team, "operative")}
        >
          انضم كلاعب
        </Button>
      </div>
    </article>
  );
}

function PlayerChip({
  id,
  name,
  active,
  switchable,
  host,
  isHost,
  onSwitchPlayer,
  onTransferHost,
  onRemovePlayer,
}: {
  id: string;
  name: string;
  active: boolean;
  switchable: boolean;
  host: boolean;
  isHost: boolean;
  onSwitchPlayer: (nextPlayerId: string) => void;
  onTransferHost: (nextHostId: string) => void;
  onRemovePlayer: (targetPlayerId: string) => void;
}) {
  return (
    <div className="cn-player-chip">
      <button
        type="button"
        className="cn-player-button"
        disabled={!switchable}
        onClick={() => onSwitchPlayer(id)}
      >
        {active ? "• " : ""}
        {name}
        {host ? " · مضيف" : ""}
      </button>
      {isHost && !host ? (
        <div className="gap-cn-1 flex">
          <button
            type="button"
            className="border-line bg-surface px-cn-2 text-ink min-h-11 min-w-11 rounded-sm border text-xs"
            onClick={() => onTransferHost(id)}
          >
            نقل
          </button>
          <button
            type="button"
            className="border-line bg-surface px-cn-2 text-ink min-h-11 min-w-11 rounded-sm border text-xs"
            onClick={() => onRemovePlayer(id)}
          >
            حذف
          </button>
        </div>
      ) : null}
    </div>
  );
}
