export interface GameModule<
  S = unknown,
  A = unknown,
  V = unknown,
  C = unknown,
> {
  id: string;
  initialState(config: C): S;
  reducer(state: S, action: A, playerId: string): S;
  viewFor(state: S, playerId: string): V;
}

export type IllegalMoveCode =
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "WRONG_ROLE"
  | "NOT_A_PLAYER"
  | "ALREADY_JOINED"
  | "CARD_ALREADY_REVEALED"
  | "CARD_OUT_OF_RANGE"
  | "INVALID_CLUE"
  | "MUST_GUESS_ONCE"
  | "LANG_LOCKED"
  | "ALREADY_STARTED"
  | "NOT_ENOUGH_PLAYERS"
  | "BAD_DEAL"
  | "INVALID_NAME"
  | "FIELD_AGENT_SEAT_TAKEN"
  | "INVALID_SIGNAL"
  | "INVALID_GUESS_COUNT"
  | "DUPLICATE_CARD"
  | "CARD_NOT_FOUND"
  | "FIELD_NOTE_TOO_LONG";

export class IllegalMove extends Error {
  readonly code: IllegalMoveCode;

  constructor(code: IllegalMoveCode, message?: string) {
    super(message ?? code);
    this.name = "IllegalMove";
    this.code = code;
  }
}

export function isIllegalMove(error: unknown): error is IllegalMove {
  return error instanceof IllegalMove;
}
