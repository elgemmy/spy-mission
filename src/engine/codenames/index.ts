import type { GameModule } from "../contract";
import { initialState } from "./initialState";
import { reducer } from "./reducer";
import type {
  Action,
  CodenamesConfig,
  GameState,
  PlayerView,
} from "./types";
import { viewFor } from "./viewFor";

export type {
  Action,
  Card,
  CardKind,
  Clue,
  CodenamesConfig,
  Concept,
  GameState,
  Lang,
  Phase,
  Player,
  PlayerView,
  Role,
  Team,
  ViewCard,
} from "./types";

export { initialState } from "./initialState";
export { reducer } from "./reducer";
export { viewFor } from "./viewFor";

export const codenames: GameModule<GameState, Action, PlayerView, CodenamesConfig> =
  {
    id: "codenames",
    initialState,
    reducer,
    viewFor,
  };
