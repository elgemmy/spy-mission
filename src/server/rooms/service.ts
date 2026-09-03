import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { z } from "zod";
import { isIllegalMove } from "../../engine/index.js";
import {
  PARTNER_MAX_FIELD_NOTE_LENGTH,
  PARTNER_MAX_SIGNAL_LENGTH,
  PARTNER_MAX_SIGNAL_COUNT,
  PARTNER_MIN_SIGNAL_COUNT,
  PARTNER_TARGET_COUNT,
  PARTNER_DECOY_COUNT,
  type PartnerCardKind,
} from "../../engine/partnerMission/index.js";
import { sampleConceptsForBoard } from "../../content/words/sampler.js";
import { applyRoomCommand } from "../../room/commands.js";
import {
  RoomError,
  banPlayer,
  createRoomRecord,
  joinRoomRecord,
  leaveRoomRecord,
} from "../../room/session.js";
import { toRoomSnapshot } from "../../room/snapshot.js";
import {
  applyPartnerRoomAction,
  createPartnerRoomRecord,
  isPartnerRoomMember,
} from "../../room/partner.js";
import type {
  PartnerRoomRecord,
  RoomCommand,
  RoomMutationResult,
  RoomRecord,
  RoomStateCommand,
  SharedRoomRecord,
  SharedRoomSnapshot,
  ResumeRoomResult,
} from "../../room/types.js";
import { normalizeRoomUi } from "../../room/uiState.js";

const ROOM_COLUMNS =
  "id,code,host_id,visibility,mode,state,ui,version,created_at,updated_at,invite_hash";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_BODY_BYTES = 16_384;

const playerName = z.string().trim().min(1).max(32);
const roomId = z.string().min(20).max(64);
const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{5,12}$/);
const playerId = z.string().uuid();

const roomCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("assignSelf"),
    team: z.enum(["red", "blue"]),
    role: z.enum(["spymaster", "operative"]),
  }),
  z.strictObject({ type: z.literal("setLang"), lang: z.enum(["ar", "en"]) }),
  z.strictObject({
    type: z.literal("setVisibility"),
    visibility: z.enum(["public", "private"]),
  }),
  z.strictObject({ type: z.literal("startGame") }),
  z.strictObject({
    type: z.literal("giveClue"),
    word: z.string().trim().min(1).max(PARTNER_MAX_SIGNAL_LENGTH),
    count: z.number().int().min(0).max(9),
  }),
  z.strictObject({
    type: z.literal("vote"),
    cardIndex: z.number().int().min(0).max(24),
  }),
  z.strictObject({ type: z.literal("clearVote") }),
  z.strictObject({
    type: z.literal("confirmGuess"),
    cardIndex: z.number().int().min(0).max(24),
  }),
  z.strictObject({ type: z.literal("endTurn") }),
  z.strictObject({ type: z.literal("returnToLobby") }),
  z.strictObject({ type: z.literal("transferHost"), nextHostId: playerId }),
  z.strictObject({ type: z.literal("renamePlayer"), name: playerName }),
  z.strictObject({
    type: z.literal("giveSignal"),
    word: z.string().trim().min(1).max(40),
    count: z
      .number()
      .int()
      .min(PARTNER_MIN_SIGNAL_COUNT)
      .max(PARTNER_MAX_SIGNAL_COUNT),
  }),
  z.strictObject({
    type: z.literal("lockGuesses"),
    cardIds: z.array(z.string().min(1).max(128)).min(1).max(9),
    fieldNote: z.string().max(PARTNER_MAX_FIELD_NOTE_LENGTH).optional(),
  }),
  z.strictObject({ type: z.literal("resolveLockedGuesses") }),
  z.strictObject({ type: z.literal("leaveRoom") }),
  z.strictObject({ type: z.literal("banPlayer"), targetPlayerId: playerId }),
  z.strictObject({ type: z.literal("deleteRoom") }),
]);

const requestSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("create"),
    name: playerName,
    lang: z.enum(["ar", "en"]),
    visibility: z.enum(["public", "private"]).optional(),
    mode: z.enum(["classic", "partner"]).optional(),
  }),
  z.strictObject({
    op: z.literal("join"),
    code: roomCode,
    name: playerName,
    inviteToken: z.string().min(32).max(128).optional(),
  }),
  z.strictObject({
    op: z.literal("claimPartnerSeat"),
    code: roomCode,
    name: playerName,
    inviteToken: z.string().min(32).max(128),
  }),
  z.strictObject({ op: z.literal("resume"), code: roomCode }),
  z.strictObject({ op: z.literal("get"), roomId }),
  z.strictObject({
    op: z.literal("command"),
    roomId,
    expectedVersion: z.number().int().positive(),
    command: roomCommandSchema,
  }),
]);

type RoomsRequest = z.infer<typeof requestSchema>;

interface StoredRoom {
  room: SharedRoomRecord;
  inviteHash: string | null;
}

interface RoomMembership {
  status: "active" | "banned";
}

let adminClient: SupabaseClient | null = null;

export async function handleRoomsRequest(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (request.method !== "POST") {
      return Response.json(
        { error: "METHOD_NOT_ALLOWED" },
        { status: 405, headers: { ...headers, Allow: "POST" } },
      );
    }
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) {
      throw new ApiError(413, "REQUEST_TOO_LARGE");
    }

    const client = getAdminClient();
    const user = await authenticate(request, client);
    const parsed = requestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_REQUEST");
    }

    const data = await execute(parsed.data, user, client);
    return Response.json({ data }, { headers });
  } catch (error) {
    const apiError = normalizeError(error);
    return Response.json(
      { error: apiError.code },
      { status: apiError.status, headers },
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new SyntaxError("Request body is required");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "REQUEST_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

async function execute(
  request: RoomsRequest,
  user: User,
  client: SupabaseClient,
): Promise<RoomMutationResult | ResumeRoomResult | null> {
  switch (request.op) {
    case "create":
      return createRoom(request, user.id, client);
    case "join":
      return joinRoom(request, user.id, client, false);
    case "claimPartnerSeat":
      return joinRoom(request, user.id, client, true);
    case "resume":
      return resumeRoom(request.code, user.id, client);
    case "get":
      return loadForMember(request.roomId, user.id, client).then((stored) =>
        stored ? toRoomSnapshot(stored.room, user.id) : null,
      );
    case "command":
      return mutateRoom(
        request.roomId,
        request.expectedVersion,
        request.command as RoomCommand,
        user.id,
        client,
      );
  }
}

async function createRoom(
  request: Extract<RoomsRequest, { op: "create" }>,
  userId: string,
  client: SupabaseClient,
): Promise<SharedRoomSnapshot> {
  const now = new Date().toISOString();
  const mode = request.mode ?? "classic";
  const visibility =
    mode === "partner" ? "private" : (request.visibility ?? "public");
  const inviteToken = createInviteToken();
  const id = `room-${randomUUID()}`;
  const seed = randomInt(1, 2_147_483_647);
  const room =
    mode === "partner"
      ? createPartnerRoomRecord({
          id,
          code: createRoomCode(),
          hostId: userId,
          hostName: request.name,
          lang: request.lang,
          concepts: sampleConceptsForBoard(seed),
          seed,
          kinds: createPartnerKinds(),
          now,
        })
      : createRoomRecord({
          id,
          code: createRoomCode(),
          hostId: userId,
          hostName: request.name,
          lang: request.lang,
          visibility,
          now,
        });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await client
      .rpc("server_create_room", {
        p_id: room.id,
        p_code: room.code,
        p_host_id: userId,
        p_visibility: room.visibility,
        p_state: room.state,
        p_ui: room.ui,
        p_version: room.version,
        p_created_at: room.createdAt,
        p_updated_at: room.updatedAt,
        p_invite_hash: hashInvite(inviteToken),
        p_mode: mode,
      })
      .single();
    if (!error && data) {
      return toRoomSnapshot(rowToStoredRoom(data).room, userId, inviteToken);
    }
    if (error?.code === "23505") {
      room.code = createRoomCode();
      continue;
    }
    throwDatabaseError(error);
  }
  throw new ApiError(503, "ROOM_CODE_EXHAUSTED");
}

async function resumeRoom(
  code: string,
  userId: string,
  client: SupabaseClient,
): Promise<ResumeRoomResult> {
  const stored = await loadByCode(code, client);
  if (!stored) {
    return { status: "notFound" };
  }
  const membership = await loadMembership(stored.room.id, userId, client);
  if (membership?.status === "banned") {
    throw new ApiError(403, "ROOM_BANNED");
  }
  if (membership?.status === "active") {
    if (!isStoredRoomMember(stored.room, userId)) {
      throw new ApiError(503, "ROOM_MEMBERSHIP_INVALID");
    }
    return {
      status: "active",
      room: toRoomSnapshot(stored.room, userId),
    };
  }
  return stored.room.mode === "partner"
    ? { status: "join", code: stored.room.code, mode: "partner" }
    : { status: "join", code: stored.room.code };
}

async function joinRoom(
  request: Extract<RoomsRequest, { op: "join" | "claimPartnerSeat" }>,
  userId: string,
  client: SupabaseClient,
  partnerClaim: boolean,
): Promise<SharedRoomSnapshot> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let stored = await loadByCode(request.code, client);
    if (!stored) {
      throw new ApiError(404, "ROOM_NOT_FOUND");
    }
    const membership = await loadMembership(stored.room.id, userId, client);
    if (membership?.status === "banned") {
      throw new ApiError(403, "ROOM_BANNED");
    }
    if ((stored.room.mode === "partner") !== partnerClaim) {
      throw new ApiError(409, "ROOM_MODE_MISMATCH");
    }
    const activeMember = membership?.status === "active";
    const inviteValid = validInvite(request.inviteToken, stored.inviteHash);
    if (!activeMember && stored.room.visibility === "private" && !inviteValid) {
      throw new ApiError(403, "ROOM_INVITE_INVALID");
    }
    if (activeMember && !isStoredRoomMember(stored.room, userId)) {
      const fresh = await loadById(stored.room.id, client);
      if (!fresh || !isStoredRoomMember(fresh.room, userId)) {
        throw new ApiError(503, "ROOM_MEMBERSHIP_INVALID");
      }
      stored = fresh;
    }

    if (activeMember) {
      if (partnerClaim) {
        throw new ApiError(409, "WRONG_PHASE");
      }
      return toRoomSnapshot(stored.room, userId);
    }

    const next =
      stored.room.mode === "partner"
        ? applyPartnerRoomAction(
            stored.room,
            userId,
            { type: "claimFieldAgent", name: request.name },
            new Date().toISOString(),
          )
        : joinRoomRecord(
            stored.room,
            userId,
            request.name,
            new Date().toISOString(),
            { allowPrivate: inviteValid },
          );
    const { data, error } = await client
      .rpc("server_join_room", {
        p_room_id: next.id,
        p_user_id: userId,
        p_state: next.state,
        p_ui: next.ui,
        p_expected_version: stored.room.version,
        p_updated_at: next.updatedAt,
        p_invite_hash: request.inviteToken
          ? hashInvite(request.inviteToken)
          : null,
        p_partner_claim: partnerClaim,
      })
      .single();
    if (!error && data) {
      return toRoomSnapshot(rowToStoredRoom(data).room, userId);
    }
    if (error?.code === "40001") {
      continue;
    }
    throwDatabaseError(error);
  }
  throw new ApiError(409, "ROOM_VERSION_CONFLICT");
}

async function mutateRoom(
  id: string,
  expectedVersion: number,
  command: RoomCommand,
  userId: string,
  client: SupabaseClient,
): Promise<RoomMutationResult> {
  const stored = await loadForMember(id, userId, client);
  if (!stored) {
    throw new ApiError(404, "ROOM_NOT_FOUND");
  }
  if (stored.room.version !== expectedVersion) {
    throw new ApiError(409, "ROOM_VERSION_CONFLICT");
  }

  if (command.type === "deleteRoom") {
    await deleteRoom(id, expectedVersion, userId, client);
    return { deleted: true };
  }
  if (stored.room.mode === "partner") {
    if (
      command.type !== "giveSignal" &&
      command.type !== "lockGuesses" &&
      command.type !== "resolveLockedGuesses"
    ) {
      throw new ApiError(409, "ROOM_MODE_MISMATCH");
    }
    const next = applyPartnerRoomAction(
      stored.room,
      userId,
      command,
      new Date().toISOString(),
    );
    if (next === stored.room) {
      return toRoomSnapshot(stored.room, userId);
    }
    const updated = await persistRoom(
      next,
      expectedVersion,
      userId,
      null,
      client,
    );
    return toRoomSnapshot(updated.room, userId);
  }
  if (
    command.type === "giveSignal" ||
    command.type === "lockGuesses" ||
    command.type === "resolveLockedGuesses"
  ) {
    throw new ApiError(409, "ROOM_MODE_MISMATCH");
  }
  if (command.type === "leaveRoom") {
    const next = leaveRoomRecord(stored.room, userId, new Date().toISOString());
    await leaveRoom(next, expectedVersion, userId, client);
    return { left: true };
  }
  if (command.type === "banPlayer") {
    const next = banPlayer(
      stored.room,
      userId,
      command.targetPlayerId,
      new Date().toISOString(),
    );
    const updated = await banRoomMember(
      next,
      expectedVersion,
      userId,
      command.targetPlayerId,
      client,
    );
    return toRoomSnapshot(updated.room, userId);
  }
  const seed =
    command.type === "startGame" ? randomInt(1, 2_147_483_647) : undefined;
  const next = applyRoomCommand(
    stored.room,
    userId,
    command as RoomStateCommand,
    new Date().toISOString(),
    seed,
  );
  if (next === stored.room) {
    return toRoomSnapshot(stored.room, userId);
  }
  let newInviteHash: string | null = null;
  let inviteToken: string | undefined;
  if (
    command.type === "setVisibility" &&
    command.visibility === "private" &&
    !stored.inviteHash
  ) {
    inviteToken = createInviteToken();
    newInviteHash = hashInvite(inviteToken);
  }

  const updated = await persistRoom(
    next,
    expectedVersion,
    userId,
    newInviteHash,
    client,
  );
  return toRoomSnapshot(updated.room, userId, inviteToken);
}

async function deleteRoom(
  id: string,
  expectedVersion: number,
  userId: string,
  client: SupabaseClient,
): Promise<void> {
  const { error } = await client.rpc("server_delete_room", {
    p_room_id: id,
    p_actor_id: userId,
    p_expected_version: expectedVersion,
  });
  throwDatabaseError(error);
}

async function leaveRoom(
  room: RoomRecord,
  expectedVersion: number,
  userId: string,
  client: SupabaseClient,
): Promise<void> {
  const { error } = await client.rpc("server_leave_room", {
    p_room_id: room.id,
    p_actor_id: userId,
    p_state: room.state,
    p_ui: room.ui,
    p_expected_version: expectedVersion,
    p_updated_at: room.updatedAt,
  });
  throwDatabaseError(error);
}

async function banRoomMember(
  room: RoomRecord,
  expectedVersion: number,
  userId: string,
  targetUserId: string,
  client: SupabaseClient,
): Promise<StoredRoom> {
  const { data, error } = await client
    .rpc("server_ban_room_member", {
      p_room_id: room.id,
      p_actor_id: userId,
      p_target_user_id: targetUserId,
      p_state: room.state,
      p_ui: room.ui,
      p_expected_version: expectedVersion,
      p_updated_at: room.updatedAt,
    })
    .single();
  throwDatabaseError(error);
  return rowToStoredRoom(data);
}

async function persistRoom(
  room: SharedRoomRecord,
  expectedVersion: number,
  userId: string,
  newInviteHash: string | null,
  client: SupabaseClient,
): Promise<StoredRoom> {
  const { data, error } = await client
    .rpc("server_update_room", {
      p_room_id: room.id,
      p_actor_id: userId,
      p_host_id: room.hostId,
      p_visibility: room.visibility,
      p_state: room.state,
      p_ui: room.ui,
      p_expected_version: expectedVersion,
      p_updated_at: room.updatedAt,
      p_new_invite_hash: newInviteHash,
    })
    .single();
  throwDatabaseError(error);
  return rowToStoredRoom(data);
}

async function loadForMember(
  id: string,
  userId: string,
  client: SupabaseClient,
): Promise<StoredRoom | null> {
  const membership = await client
    .from("room_members")
    .select("room_id,status")
    .eq("room_id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  throwDatabaseError(membership.error);
  return membership.data ? loadById(id, client) : null;
}

async function loadMembership(
  roomIdValue: string,
  userId: string,
  client: SupabaseClient,
): Promise<RoomMembership | null> {
  const { data, error } = await client
    .from("room_members")
    .select("status")
    .eq("room_id", roomIdValue)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error);
  if (!data) {
    return null;
  }
  return { status: data.status === "banned" ? "banned" : "active" };
}

async function loadById(
  id: string,
  client: SupabaseClient,
): Promise<StoredRoom | null> {
  const { data, error } = await client
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  throwDatabaseError(error);
  return data ? rowToStoredRoom(data) : null;
}

async function loadByCode(
  code: string,
  client: SupabaseClient,
): Promise<StoredRoom | null> {
  const { data, error } = await client
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  throwDatabaseError(error);
  return data ? rowToStoredRoom(data) : null;
}

async function authenticate(
  request: Request,
  client: SupabaseClient,
): Promise<User> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  return data.user;
}

function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new ApiError(500, "ROOM_SERVER_MISCONFIGURED");
  }
  adminClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

function rowToStoredRoom(value: unknown): StoredRoom {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(503, "ROOM_STORAGE_ERROR");
  }
  const row = value as Record<string, unknown>;
  const rawState = row.state;
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    throw new ApiError(503, "ROOM_STORAGE_ERROR");
  }
  const stateMode = (rawState as Record<string, unknown>).mode;
  if (
    (row.mode === "partner" && stateMode !== "partner") ||
    (row.mode !== "partner" && stateMode === "partner")
  ) {
    throw new ApiError(503, "ROOM_STORAGE_ERROR");
  }
  const base: Omit<RoomRecord, "state" | "mode"> = {
    id: String(row.id),
    code: String(row.code),
    hostId: String(row.host_id),
    visibility: row.visibility === "private" ? "private" : "public",
    ui: normalizeRoomUi(row.ui as Partial<RoomRecord["ui"]> | null),
    version: Number(row.version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
  const room: SharedRoomRecord =
    row.mode === "partner"
      ? {
          ...base,
          mode: "partner",
          visibility: "private",
          state: rawState as PartnerRoomRecord["state"],
        }
      : {
          ...base,
          mode: "classic",
          state: rawState as RoomRecord["state"],
        };
  return {
    room,
    inviteHash: typeof row.invite_hash === "string" ? row.invite_hash : null,
  };
}

function isStoredRoomMember(room: SharedRoomRecord, userId: string): boolean {
  return room.mode === "partner"
    ? isPartnerRoomMember(room, userId)
    : Boolean(room.state.players[userId]);
}

function createRoomCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(
    bytes,
    (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length],
  ).join("");
}

function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function createPartnerKinds(): PartnerCardKind[] {
  const kinds: PartnerCardKind[] = [
    ...Array<PartnerCardKind>(PARTNER_TARGET_COUNT).fill("target"),
    ...Array<PartnerCardKind>(PARTNER_DECOY_COUNT).fill("decoy"),
    "trap",
  ];
  for (let index = kinds.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [kinds[index], kinds[swapIndex]] = [kinds[swapIndex]!, kinds[index]!];
  }
  return kinds;
}

function hashInvite(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function validInvite(
  token: string | undefined,
  expectedHash: string | null,
): boolean {
  if (!token || !expectedHash) {
    return false;
  }
  const actual = Buffer.from(hashInvite(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function throwDatabaseError(
  error: { code?: string; message?: string } | null,
): void {
  if (!error) {
    return;
  }
  if (error.code === "40001") {
    throw new ApiError(409, "ROOM_VERSION_CONFLICT");
  }
  const knownCode = [
    "ROOM_BANNED",
    "ROOM_NOT_FOUND",
    "ROOM_NOT_MEMBER",
    "ROOM_INVITE_INVALID",
    "ROOM_MEMBERSHIP_INVALID",
    "ROOM_FULL",
    "ROOM_MODE_INVALID",
    "ROOM_MODE_MISMATCH",
    "FIELD_AGENT_SEAT_TAKEN",
    "WRONG_PHASE",
    "NOT_HOST",
    "HOST_LEAVE_FORBIDDEN",
    "HOST_REMOVE_FORBIDDEN",
    "LEAVE_LOBBY_ONLY",
    "PLAYER_NOT_FOUND",
  ].find((code) => error.message?.includes(code));
  if (knownCode) {
    const status =
      knownCode === "ROOM_NOT_FOUND" || knownCode === "ROOM_NOT_MEMBER"
        ? 404
        : knownCode === "ROOM_BANNED" ||
            knownCode === "ROOM_INVITE_INVALID" ||
            knownCode === "NOT_HOST"
          ? 403
          : 409;
    throw new ApiError(status, knownCode);
  }
  throw new ApiError(503, "ROOM_STORAGE_ERROR");
}

class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (isIllegalMove(error)) {
    return new ApiError(409, error.code);
  }
  if (error instanceof RoomError) {
    const status = error.code === "NOT_HOST" ? 403 : 409;
    return new ApiError(status, error.code);
  }
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return new ApiError(400, "INVALID_REQUEST");
  }
  return new ApiError(500, "ROOM_SERVER_ERROR");
}

export function resetAdminClientForTests(): void {
  adminClient = null;
}

export function setAdminClientForTests(client: SupabaseClient): void {
  adminClient = client;
}
