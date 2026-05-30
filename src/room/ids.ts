const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createClientId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `player-${createSeed().toString(36)}`;
}

export function createRoomId(): string {
  return `room-${createClientId()}`;
}

export function createRoomCode(length = 5): string {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    const seed = createSeed();
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (seed + index * 37) % 256;
    }
  }
  return Array.from(
    bytes,
    (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length],
  ).join("");
}

export function createSeed(): number {
  const bytes = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] ?? 1;
  }
  return Date.now() % 2147483647;
}
