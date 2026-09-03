import type { GameModule } from "../contract.js";
import { initialState } from "./initialState.js";
import { reducer } from "./reducer.js";
import type {
  Action,
  CodenamesConfig,
  GameState,
  PlayerView,
} from "./types.js";
import { viewFor } from "./viewFor.js";

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
} from "./types.js";

export { initialState } from "./initialState.js";
export { reducer } from "./reducer.js";
export { viewFor } from "./viewFor.js";

export const codenames: GameModule<GameState, Action, PlayerView, CodenamesConfig> =
  {
    id: "codenames",
    initialState,
    reducer,
    viewFor,
  };
