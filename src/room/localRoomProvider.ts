import {
  createClientId,
  createRoomCode,
  createRoomId,
  createSeed,
} from "./ids";
import { applyRoomCommand } from "./commands";
import { inMemoryRoomProvider } from "./inMemoryRoomProvider";
import { createRoomRecord, joinRoomRecord } from "./session";
import { toRoomSnapshot } from "./snapshot";
import type {
  CreateSharedRoomInput,
  JoinSharedRoomInput,
  RoomCommand,
  RoomProvider,
  RoomSnapshot,
  Unsubscribe,
} from "./types";

const LOCAL_PLAYER_KEY = "codenames.localPlayerId.v2";

export class LocalRoomProvider implements RoomProvider {
  private readonly playerId = loadOrCreatePlayerId();

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
    return toRoomSnapshot(room, this.playerId);
  }

  async join(input: JoinSharedRoomInput): Promise<RoomSnapshot> {
    const room = await inMemoryRoomProvider.loadByCode(input.code);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    const next = joinRoomRecord(
      room,
      this.playerId,
      input.name,
      new Date().toISOString(),
      { allowPrivate: Boolean(input.inviteToken) },
    );
    await inMemoryRoomProvider.save(next, room.version);
    return toRoomSnapshot(next, this.playerId);
  }

  async load(roomId: string): Promise<RoomSnapshot | null> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (!room?.state.players[this.playerId]) {
      return null;
    }
    return toRoomSnapshot(room, this.playerId);
  }

  async mutate(
    roomId: string,
    expectedVersion: number,
    command: RoomCommand,
  ): Promise<RoomSnapshot> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    if (room.version !== expectedVersion) {
      throw new Error("ROOM_VERSION_CONFLICT");
    }
    const next = applyRoomCommand(
      room,
      this.playerId,
      command,
      new Date().toISOString(),
      command.type === "startGame" ? createSeed() : undefined,
    );
    await inMemoryRoomProvider.save(next, expectedVersion);
    return toRoomSnapshot(next, this.playerId);
  }

  async delete(roomId: string): Promise<void> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (!room || room.hostId !== this.playerId) {
      throw new Error("NOT_HOST");
    }
    await inMemoryRoomProvider.delete(roomId);
  }

  async ensureInvite(roomId: string): Promise<string> {
    const room = await inMemoryRoomProvider.load(roomId);
    if (!room || room.hostId !== this.playerId) {
      throw new Error("NOT_HOST");
    }
    return room.code;
  }

  subscribe(
    roomId: string,
    onChange: (room: RoomSnapshot | null) => void,
  ): Unsubscribe {
    return inMemoryRoomProvider.subscribe(roomId, (room) => {
      onChange(
        room?.state.players[this.playerId]
          ? toRoomSnapshot(room, this.playerId)
          : null,
      );
    });
  }
}

export const localRoomProvider = new LocalRoomProvider();

function loadOrCreatePlayerId(): string {
  try {
    const existing = globalThis.localStorage?.getItem(LOCAL_PLAYER_KEY);
    if (existing) {
      return existing;
    }
    const playerId = createClientId();
    globalThis.localStorage?.setItem(LOCAL_PLAYER_KEY, playerId);
    return playerId;
  } catch {
    return createClientId();
  }
}
