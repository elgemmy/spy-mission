/**
 * Canonical URLs for the two surfaces of this site (see
 * `docs/planning/adr-001-landing-and-play-route.md`):
 *
 * - `/`      — the marketing landing page (`src/landing`)
 * - `/play/` — the game (`src/app/App.tsx`)
 *
 * Components must never hardcode `/play/`; build links with `playUrl()`.
 */

export const LANDING_PATH = "/";
export const PLAY_PATH = "/play/";

export interface PlayUrlOptions {
  /** Jump straight to the "choose your name" create step. */
  create?: boolean;
  /** Invite code to join. Trimmed and upper-cased. */
  room?: string;
  /** Open the install sheet on arrival. */
  install?: boolean;
}

export interface PlayParams {
  room: string | null;
  create: boolean;
  install: boolean;
}

function normalizeRoomCode(room: string | null | undefined): string | null {
  return room?.trim().toUpperCase() || null;
}

/**
 * Relative URL into the game, e.g. `/play/?room=ABC12`.
 * Params are emitted in a stable order: `room`, `create`, `install`.
 */
export function playUrl(options: PlayUrlOptions = {}): string {
  const params = new URLSearchParams();

  const room = normalizeRoomCode(options.room);
  if (room) {
    params.set("room", room);
  }
  if (options.create) {
    params.set("create", "1");
  }
  if (options.install) {
    params.set("install", "1");
  }

  const query = params.toString();
  return query ? `${PLAY_PATH}?${query}` : PLAY_PATH;
}

/** Same as {@link playUrl} but absolute, for share/invite links. */
export function absolutePlayUrl(
  origin: string,
  options: PlayUrlOptions = {},
): string {
  return `${origin.replace(/\/+$/, "")}${playUrl(options)}`;
}

function readFlag(params: URLSearchParams, key: string): boolean {
  const value = params.get(key);
  if (value === null) {
    return false;
  }
  return value === "" || value === "1" || value.toLowerCase() === "true";
}

/**
 * Parse a `location.search` string into the game's deep-link params.
 * Never throws: malformed input yields the empty result.
 */
export function readPlayParams(search: string): PlayParams {
  try {
    const params = new URLSearchParams(search);
    return {
      room: normalizeRoomCode(params.get("room")),
      create: readFlag(params, "create"),
      install: readFlag(params, "install"),
    };
  } catch {
    return { room: null, create: false, install: false };
  }
}

/** Display label for the game URL, e.g. `spymaster.example.com/play`. */
export function playHostLabel(host: string): string {
  return `${host.replace(/\/+$/, "")}${PLAY_PATH.replace(/\/+$/, "")}`;
}
