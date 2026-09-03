export type { GameModule, IllegalMoveCode } from "./contract.js";
export { IllegalMove, isIllegalMove } from "./contract.js";
export {
  codenames,
  initialState,
  reducer,
  viewFor,
} from "./codenames/index.js";
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
} from "./codenames/index.js";
