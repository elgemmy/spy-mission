import { describe, expect, it } from "vitest";
import { reducer } from "./reducer";
import { lobbyWithRoster, startTestGame } from "./testFixtures";
import { viewFor } from "./viewFor";

describe("codenames viewFor contract", () => {
  it("hides unrevealed kinds from operatives", () => {
    const state = startTestGame();
    const operativeView = viewFor(state, "p-red-op");
    const spymasterView = viewFor(state, "p-red-sm");

    expect(operativeView.board.every((card) => card.kind === null)).toBe(true);
    expect(spymasterView.board.every((card) => card.kind !== null)).toBe(true);
  });

  it("shows revealed kinds to everyone", () => {
    let state = startTestGame();
    const team = state.turn;
    const operativeId = team === "red" ? "p-red-op" : "p-blue-op";
    const spymasterId = team === "red" ? "p-red-sm" : "p-blue-sm";

    state = reducer(
      state,
      { type: "giveClue", word: "go", count: 1 },
      spymasterId,
    );
    state = reducer(state, { type: "guess", cardIndex: 0 }, operativeId);

    const operativeView = viewFor(state, operativeId);
    expect(operativeView.board[0]?.kind).not.toBeNull();
    expect(operativeView.board[0]?.revealed).toBe(true);
  });

  it("derives guessesRemaining", () => {
    let state = startTestGame();
    const team = state.turn;
    const operativeId = team === "red" ? "p-red-op" : "p-blue-op";
    const spymasterId = team === "red" ? "p-red-sm" : "p-blue-sm";

    expect(viewFor(state, operativeId).guessesRemaining).toBeNull();

    state = reducer(
      state,
      { type: "giveClue", word: "go", count: 0 },
      spymasterId,
    );
    expect(viewFor(state, operativeId).guessesRemaining).toBe("unlimited");

    state = reducer(
      startTestGame(),
      { type: "giveClue", word: "go", count: 2 },
      spymasterId,
    );
    expect(viewFor(state, operativeId).guessesRemaining).toBe(3);
  });

  it("exposes can affordances by role and phase", () => {
    const lobby = lobbyWithRoster();
    const lobbyView = viewFor(lobby, "p-red-sm");

    expect(lobbyView.can.startGame).toBe(true);
    expect(lobbyView.can.giveClue).toBe(false);

    const playing = startTestGame();
    const spymasterView = viewFor(
      playing,
      playing.turn === "red" ? "p-red-sm" : "p-blue-sm",
    );
    expect(spymasterView.can.giveClue).toBe(true);
    expect(spymasterView.can.guess).toBe(false);
  });

  it("exposes no affordances after the game ends", () => {
    let state = startTestGame();
    const assassinIndex = state.board.findIndex(
      (card) => card.kind === "assassin",
    );
    const operativeId = state.turn === "red" ? "p-red-op" : "p-blue-op";
    const spymasterId = state.turn === "red" ? "p-red-sm" : "p-blue-sm";

    state = reducer(
      state,
      { type: "giveClue", word: "go", count: 0 },
      spymasterId,
    );
    state = reducer(
      state,
      { type: "guess", cardIndex: assassinIndex },
      operativeId,
    );

    expect(state.phase).toBe("ended");
    expect(
      Object.values(viewFor(state, operativeId).can).every(
        (allowed) => !allowed,
      ),
    ).toBe(true);
  });
});
