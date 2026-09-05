import {
  createClientId,
  createRoomCode,
  createRoomId,
  createSeed,
} from "./ids";
import { applyRoomCommand } from "./commands";
import { sampleConceptsForBoard } from "../content/words/sampler";
import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import {
  banPlayer,
  createRoomRecord,
  joinRoomRecord,
  leaveRoomRecord,
} from "./session";
import { toRoomSnapshot } from "./snapshot";
import {
  applyPartnerRoomAction,
  createPartnerRoomRecord,
  isPartnerRoomMember,
} from "./partner";
import type {
  CreateSharedRoomInput,
  CreateClassicRoomInput,
  CreatePartnerRoomInput,
  ClaimPartnerSeatInput,
  JoinSharedRoomInput,
  ResumeRoomResult,
  RoomCommand,
  RoomMutationResult,
  RoomProvider,
  RoomSnapshot,
  SharedRoomSnapshot,
  PartnerRoomSnapshot,
  RoomStateCommand,
  Unsubscribe,
} from "./types";

const localBans = new Map<string, Set<string>>();
// Room authority survives an individual player's cache cleanup.
const roomInviteTokens = new Map<string, string>();

export class LocalRoomProvider implements RoomProvider {
  private readonly playerId: string;
  private readonly inviteCache = new Map<string, string>();

  constructor(playerId = createClientId()) {
    this.playerId = playerId;
  }

  async create(input: CreatePartnerRoomInput): Promise<PartnerRoomSnapshot>;
  async create(input: CreateClassicRoomInput): Promise<RoomSnapshot>;
  async create(input: CreateSharedRoomInput): Promise<SharedRoomSnapshot> {
    const now = new Date().toISOString();
    const id = createRoomId();
    const code = createRoomCode(8);
    const seed = createSeed();
    const room =
      input.mode === "partner"
        ? createPartnerRoomRecord({
            id,
            code,
            hostId: this.playerId,
            hostName: input.name,
            lang: input.lang,
            concepts: sampleConceptsForBoard(seed),
            seed,
            now,
          })
        : createRoomRecord({
            id,
            code,
            hostId: this.playerId,
            hostName: input.name,
            lang: input.lang,
            visibility: input.visibility,
            now,
          });
    await inMemoryRoomProvider.create(room);
    const inviteToken = createClientId();
    roomInviteTokens.set(room.id, inviteToken);
    this.inviteCache.set(room.id, inviteToken);
    return toRoomSnapshot(room, this.playerId, inviteToken);
  }

  async resume(code: string): Promise<ResumeRoomResult> {
    const room = await inMemoryRoomProvider.loadByCode(code);
    if (!room) {
      return { status: "notFound" };
    }
    if (isLocallyBanned(room.id, this.playerId)) {
      throw new Error("ROOM_BANNED");
    }
    const isMember =
      room.mode === "partner"
        ? isPartnerRoomMember(room, this.playerId)
        : Boolean(room.state.players[this.playerId]);
    if (!isMember) {
      return room.mode === "partner"
        ? { status: "join", code: room.code, mode: "partner" }
        : { status: "join", code: room.code };
    }
    return {
      status: "active",
      room: toRoomSnapshot(room, this.playerId, this.inviteCache.get(room.id)),
    };
  }

  async join(input: JoinSharedRoomInput): Promise<RoomSnapshot> {
    const room = await inMemoryRoomProvider.loadByCode(input.code);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    if (isLocallyBanned(room.id, this.playerId)) {
      throw new Error("ROOM_BANNED");
    }
    if (room.mode === "partner") {
      throw new Error("ROOM_MODE_MISMATCH");
    }
    const expectedInvite = roomInviteTokens.get(room.id);
    const allowPrivate =
      room.visibility === "public" ||
      Boolean(expectedInvite && input.inviteToken === expectedInvite);
    const next = joinRoomRecord(
      room,
      this.playerId,
      input.name,
      new Date().toISOString(),
      { allowPrivate },
    );
    if (next !== room) {
      await inMemoryRoomProvider.save(next, room.version);
    }
    if (
      room.visibility === "private" &&
      input.inviteToken &&
      input.inviteToken === expectedInvite
    ) {
      this.inviteCache.set(room.id, input.inviteToken);
    }
    return toRoomSnapshot(next, this.playerId, this.inviteCache.get(room.id));
  }

  async claimPartnerSeat(
    input: ClaimPartnerSeatInput,
  ): Promise<PartnerRoomSnapshot> {
    const room = await inMemoryRoomProvider.loadByCode(input.code);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    if (room.mode !== "partner") {
      throw new Error("ROOM_MODE_MISMATCH");
    }
    if (isLocallyBanned(room.id, this.playerId)) {
      throw new Error("ROOM_BANNED");
    }
    const expectedInvite = roomInviteTokens.get(room.id);
    if (!expectedInvite || input.inviteToken !== expectedInvite) {
      throw new Error("ROOM_PRIVATE");
    }
    if (isPartnerRoomMember(room, this.playerId)) {
      throw new Error("WRONG_PHASE");
    }
    const next = applyPartnerRoomAction(
      room,
      this.playerId,
      { type: "claimFieldAgent", name: input.name },
      new Date().toISOString(),
    );
    await inMemoryRoomProvider.save(next, room.version);
    this.inviteCache.set(room.id, expectedInvite);
    return toRoomSnapshot(next, this.playerId, expectedInvite);
  }

  async load(roomId: string): Promise<SharedRoomSnapshot | null> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (
      !room ||
      (room.mode === "partner"
        ? !isPartnerRoomMember(room, this.playerId)
        : !room.state.players[this.playerId]) ||
      isLocallyBanned(roomId, this.playerId)
    ) {
      return null;
    }
    return toRoomSnapshot(room, this.playerId, this.inviteCache.get(room.id));
  }

  async mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomMutationResult> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (!room || isLocallyBanned(roomId, this.playerId)) {
      throw new Error("ROOM_NOT_FOUND");
    }
    if (room.version !== expectedVersion) {
      throw new Error("ROOM_VERSION_CONFLICT");
    }
    // The awaited load may have raced another write. Check the live store
    // before changing local ban/invite metadata; no await precedes the write.
    inMemoryRoomProvider.assertVersion(roomId, expectedVersion);

    if (command.type === "deleteRoom") {
      if (room.hostId !== this.playerId) {
        throw new Error("NOT_HOST");
      }
      await inMemoryRoomProvider.delete(roomId);
      localBans.delete(roomId);
      roomInviteTokens.delete(roomId);
      this.inviteCache.delete(roomId);
      return { deleted: true };
    }

    const now = new Date().toISOString();
    if (room.mode === "partner") {
      if (
        command.type !== "giveSignal" &&
        command.type !== "lockGuesses" &&
        command.type !== "resolveLockedGuesses"
      ) {
        throw new Error("ROOM_MODE_MISMATCH");
      }
      const next = applyPartnerRoomAction(room, this.playerId, command, now);
      if (next !== room) {
        await inMemoryRoomProvider.save(next, expectedVersion);
      }
      return toRoomSnapshot(next, this.playerId, this.inviteCache.get(roomId));
    }
    if (command.type === "leaveRoom") {
      const next = leaveRoomRecord(room, this.playerId, now);
      await inMemoryRoomProvider.save(next, expectedVersion);
      return { left: true };
    }
    if (command.type === "banPlayer") {
      const next = banPlayer(room, this.playerId, command.targetPlayerId, now);
      const banned = localBans.get(roomId) ?? new Set<string>();
      banned.add(command.targetPlayerId);
      localBans.set(roomId, banned);
      await inMemoryRoomProvider.save(next, expectedVersion);
      return toRoomSnapshot(next, this.playerId, this.inviteCache.get(roomId));
    }
    const inviteToken = this.inviteCache.get(roomId);
    const next = applyRoomCommand(
      room,
      this.playerId,
      command as RoomStateCommand,
      now,
      command.type === "startGame" ? createSeed() : undefined,
    );
    if (next !== room) {
      await inMemoryRoomProvider.save(next, expectedVersion);
    }
    return toRoomSnapshot(next, this.playerId, inviteToken);
  }

  getInviteToken(roomId: string): string | null {
    return this.inviteCache.get(roomId) ?? null;
  }

  clearRoomStorage(roomId: string): void {
    this.inviteCache.delete(roomId);
  }

  subscribe(
    roomId: string,
    onChange: (room: SharedRoomSnapshot | null) => void,
  ): Unsubscribe {
    return inMemoryRoomProvider.subscribe(roomId, (room) => {
      onChange(
        room &&
          (room.mode === "partner"
            ? isPartnerRoomMember(room, this.playerId)
            : Boolean(room.state.players[this.playerId])) &&
          !isLocallyBanned(roomId, this.playerId)
          ? toRoomSnapshot(room, this.playerId, this.inviteCache.get(roomId))
          : null,
      );
    });
  }
}

export const localRoomProvider = new LocalRoomProvider();

function isLocallyBanned(roomId: string, playerId: string): boolean {
  return localBans.get(roomId)?.has(playerId) ?? false;
}
