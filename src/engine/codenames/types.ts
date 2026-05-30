export type Team = "red" | "blue";
export type Role = "spymaster" | "operative";
export type Lang = "ar" | "en";

export type CardKind = "red" | "blue" | "neutral" | "assassin";

export type Phase = "lobby" | "clue" | "guess" | "ended";

export interface Concept {
  id: string;
  en: string;
  ar: string;
}

export interface Card {
  concept: Concept;
  kind: CardKind;
  revealed: boolean;
}

export interface Player {
  name: string;
  team: Team;
  role: Role;
}

export interface Clue {
  word: string;
  count: number;
}

export interface GameState {
  roomId: string;
  lang: Lang;
  phase: Phase;
  board: Card[];
  startingTeam: Team | null;
  turn: Team;
  clue: Clue | null;
  guessesMadeThisTurn: number;
  players: Record<string, Player>;
  winner: Team | null;
}

export type Action =
  | { type: "joinRoom"; name: string }
  | { type: "assignSelf"; team: Team; role: Role }
  | { type: "setLang"; lang: Lang }
  | { type: "startGame"; concepts: Concept[]; seed: number }
  | { type: "giveClue"; word: string; count: number }
  | { type: "guess"; cardIndex: number }
  | { type: "endTurn" };

export interface ViewCard {
  concept: Concept;
  revealed: boolean;
  kind: CardKind | null;
}

export interface PlayerView {
  roomId: string;
  lang: Lang;
  phase: Phase;
  board: ViewCard[];
  turn: Team;
  clue: Clue | null;
  redRemaining: number;
  blueRemaining: number;
  guessesRemaining: number | "unlimited" | null;
  winner: Team | null;
  me: { id: string; team: Team; role: Role } | null;
  players: Array<{ id: string; name: string; team: Team; role: Role }>;
  can: {
    joinRoom: boolean;
    assignSelf: boolean;
    setLang: boolean;
    startGame: boolean;
    giveClue: boolean;
    guess: boolean;
    endTurn: boolean;
  };
}

export interface CodenamesConfig {
  roomId: string;
  lang: Lang;
}
