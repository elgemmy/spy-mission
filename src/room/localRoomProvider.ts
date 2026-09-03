import {
  createClientId,
  createRoomCode,
  createRoomId,
  createSeed,
} from "./ids";
import { applyRoomCommand } from "./commands";
import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import {
  banPlayer,
  createRoomRecord,
  joinRoomRecord,
  leaveRoomRecord,
} from "./session";
import { toRoomSnapshot } from "./snapshot";
import type {
  CreateSharedRoomInput,
  JoinSharedRoomInput,
  ResumeRoomResult,
  RoomCommand,
  RoomMutationResult,
  RoomProvider,
  RoomSnapshot,
  RoomStateCommand,
  Unsubscribe,
} from "./types";

const localBans = new Map<string, Set<string>>();
const localInvites = new Map<string, string>();

export class LocalRoomProvider implements RoomProvider {
  private readonly playerId: string;

  constructor(playerId = createClientId()) {
    this.playerId = playerId;
  }

  async create(input: CreateSharedRoomInput): Promise<RoomSnapshot> {
    const now = new Date().toISOString();
    const room = createRoomRecord({
      id: createRoomId(),
      code: createRoomCode(8),
      hostId: this.playerId,
      hostName: input.name,
      lang: input.lang,
      visibility: input.visibility,
      now,
    });
    await inMemoryRoomProvider.create(room);
    if (room.visibility === "private") {
      const inviteToken = createClientId();
      localInvites.set(room.id, inviteToken);
      return toRoomSnapshot(room, this.playerId, inviteToken);
    }
    return toRoomSnapshot(room, this.playerId);
  }

  async resume(code: string): Promise<ResumeRoomResult> {
    const room = await inMemoryRoomProvider.loadByCode(code);
    if (!room) {
      return { status: "notFound" };
    }
    if (isLocallyBanned(room.id, this.playerId)) {
      throw new Error("ROOM_BANNED");
    }
    if (!room.state.players[this.playerId]) {
      return { status: "join", code: room.code };
    }
    return {
      status: "active",
      room: toRoomSnapshot(room, this.playerId, localInvites.get(room.id)),
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
    const expectedInvite = localInvites.get(room.id);
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
    await inMemoryRoomProvider.save(next, room.version);
    return toRoomSnapshot(next, this.playerId);
  }

  async load(roomId: string): Promise<RoomSnapshot | null> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (
      !room?.state.players[this.playerId] ||
      isLocallyBanned(roomId, this.playerId)
    ) {
      return null;
    }
    return toRoomSnapshot(room, this.playerId, localInvites.get(room.id));
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

    const now = new Date().toISOString();
    if (command.type === "leaveRoom") {
      const next = leaveRoomRecord(room, this.playerId, now);
      await inMemoryRoomProvider.save(next, expectedVersion);
      this.clearRoomStorage(roomId);
      return { left: true };
    }
    if (command.type === "banPlayer") {
      const next = banPlayer(room, this.playerId, command.targetPlayerId, now);
      const banned = localBans.get(roomId) ?? new Set<string>();
      banned.add(command.targetPlayerId);
      localBans.set(roomId, banned);
      await inMemoryRoomProvider.save(next, expectedVersion);
      return toRoomSnapshot(next, this.playerId, localInvites.get(roomId));
    }
    if (command.type === "deleteRoom") {
      if (room.hostId !== this.playerId) {
        throw new Error("NOT_HOST");
      }
      await inMemoryRoomProvider.delete(roomId);
      localBans.delete(roomId);
      this.clearRoomStorage(roomId);
      return { deleted: true };
    }
    if (command.type === "regenerateInvite") {
      if (room.hostId !== this.playerId) {
        throw new Error("NOT_HOST");
      }
      const inviteToken = createClientId();
      const next = {
        ...room,
        version: room.version + 1,
        updatedAt: now,
      };
      localInvites.set(roomId, inviteToken);
      await inMemoryRoomProvider.save(next, expectedVersion);
      return toRoomSnapshot(next, this.playerId, inviteToken);
    }

    let inviteToken = localInvites.get(roomId);
    if (
      command.type === "setVisibility" &&
      command.visibility === "private" &&
      !inviteToken
    ) {
      inviteToken = createClientId();
      localInvites.set(roomId, inviteToken);
    }
    const next = applyRoomCommand(
      room,
      this.playerId,
      command as RoomStateCommand,
      now,
      command.type === "startGame" ? createSeed() : undefined,
    );
    await inMemoryRoomProvider.save(next, expectedVersion);
    return toRoomSnapshot(next, this.playerId, inviteToken);
  }

  getInviteToken(roomId: string): string | null {
    return localInvites.get(roomId) ?? null;
  }

  clearRoomStorage(roomId: string): void {
    localInvites.delete(roomId);
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomSnapshot | null) => void,
  ): Unsubscribe {
    return inMemoryRoomProvider.subscribe(roomId, (room) => {
      onChange(
        room?.state.players[this.playerId] &&
          !isLocallyBanned(roomId, this.playerId)
          ? toRoomSnapshot(room, this.playerId, localInvites.get(roomId))
          : null,
      );
    });
  }
}

export const localRoomProvider = new LocalRoomProvider();

function isLocallyBanned(roomId: string, playerId: string): boolean {
  return localBans.get(roomId)?.has(playerId) ?? false;
}
