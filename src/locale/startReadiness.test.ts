// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { PlayerView } from "../engine";
import { missingStartSeats, startReadiness } from "./startReadiness";

function view(players: PlayerView["players"]): PlayerView {
  return {
    roomId: "room",
    lang: "en",
    phase: "lobby",
    board: [],
    turn: "red",
    clue: null,
    redRemaining: 0,
    blueRemaining: 0,
    guessesRemaining: null,
    winner: null,
    me: players[0]
      ? { id: players[0].id, team: players[0].team, role: players[0].role }
      : null,
    players,
    can: {
      joinRoom: false,
      assignSelf: true,
      setLang: true,
      startGame: players.length >= 4,
      giveClue: false,
      guess: false,
      endTurn: false,
    },
  };
}

describe("startReadiness", () => {
  it("lists every missing Mission Lead and Field Agent seat", () => {
    const seats = missingStartSeats(
      view([
        {
          id: "1",
          name: "Host",
          team: "red",
          role: "operative",
        },
      ]),
    );

    expect(seats).toEqual([
      { team: "red", role: "spymaster" },
      { team: "blue", role: "spymaster" },
      { team: "blue", role: "operative" },
    ]);
  });

  it("is ready only for a host with a complete roster", () => {
    const complete = view([
      { id: "1", name: "A", team: "red", role: "spymaster" },
      { id: "2", name: "B", team: "red", role: "operative" },
      { id: "3", name: "C", team: "blue", role: "spymaster" },
      { id: "4", name: "D", team: "blue", role: "operative" },
    ]);

    expect(startReadiness(complete, true).canStart).toBe(true);
    expect(startReadiness(complete, false).canStart).toBe(false);
    expect(startReadiness(complete, false).missing).toEqual([]);
  });
});
