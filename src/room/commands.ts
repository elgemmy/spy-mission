import { sampleConceptsForBoard } from "../content/words/sampler";
import {
  clearVote,
  confirmGuess,
  dispatchRoomAction,
  removePlayer,
  renamePlayer,
  returnToLobby,
  startNewGame,
  transferHost,
  updateRoomSettings,
  voteCard,
} from "./session";
import type { RoomCommand, RoomRecord } from "./types";

export function applyRoomCommand(
  room: RoomRecord,
  playerId: string,
  command: RoomCommand,
  now: string,
  seed?: number,
): RoomRecord {
  switch (command.type) {
    case "assignSelf":
      return dispatchRoomAction(room, command, playerId, now);
    case "setLang":
      return updateRoomSettings(room, playerId, { lang: command.lang }, now);
    case "setVisibility":
      return updateRoomSettings(
        room,
        playerId,
        { visibility: command.visibility },
        now,
      );
    case "startGame": {
      if (seed === undefined) {
        throw new Error("ROOM_SEED_REQUIRED");
      }
      return startNewGame(
        room,
        playerId,
        sampleConceptsForBoard(seed),
        seed,
        now,
      );
    }
    case "giveClue":
      return dispatchRoomAction(room, command, playerId, now);
    case "vote":
      return voteCard(room, playerId, command.cardIndex, now);
    case "clearVote":
      return clearVote(room, playerId, now);
    case "confirmGuess":
      return confirmGuess(room, playerId, command.cardIndex, now);
    case "endTurn":
      return dispatchRoomAction(room, command, playerId, now);
    case "returnToLobby":
      return returnToLobby(room, playerId, now);
    case "transferHost":
      return transferHost(room, playerId, command.nextHostId, now);
    case "removePlayer":
      return removePlayer(room, playerId, command.targetPlayerId, now);
    case "renamePlayer":
      return renamePlayer(room, playerId, command.name, now);
  }
}
