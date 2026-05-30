import type { GameState } from "../engine";

export type Unsubscribe = () => void;

export interface RoomProvider {
  load(roomId: string): Promise<GameState | null>;
  save(roomId: string, state: GameState): Promise<void>;
  subscribe(
    roomId: string,
    onChange: (state: GameState) => void,
  ): Unsubscribe;
}
