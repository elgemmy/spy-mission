import { describe, expect, it } from "vitest";
import { IllegalMove } from "../contract";
import { buildBoard } from "./deal";
import { initialState } from "./initialState";
import { reducer } from "./reducer";
import { lobbyWithRoster, makeConcepts, startTestGame } from "./testFixtures";

describe("codenames reducer contract", () => {
  it("deals deterministically from seed", () => {
    const concepts = makeConcepts();
    const a = buildBoard(concepts, 99);
    const b = buildBoard(concepts, 99);
    const c = buildBoard(concepts, 100);

    expect(a.board.map((card) => card.kind)).toEqual(
      b.board.map((card) => card.kind),
    );
    expect(a.board.map((card) => card.concept.id)).toEqual(
      b.board.map((card) => card.concept.id),
    );
    expect(a.board.map((card) => card.kind)).not.toEqual(
      c.board.map((card) => card.kind),
    );
  });

  it("locks language outside lobby", () => {
    const playing = startTestGame();
    expect(() =>
      reducer(playing, { type: "setLang", lang: "en" }, "p-red-sm"),
    ).toThrowError(
      expect.objectContaining({
        code: "LANG_LOCKED",
      } satisfies Partial<IllegalMove>),
    );
  });

  it("rejects spymaster guessing", () => {
    const state = startTestGame();
    const spymasterTeam = state.turn;
    const spymasterId = spymasterTeam === "red" ? "p-red-sm" : "p-blue-sm";

    const withClue = reducer(
      state,
      { type: "giveClue", word: "test", count: 1 },
      spymasterId,
    );

    expect(() =>
      reducer(withClue, { type: "guess", cardIndex: 0 }, spymasterId),
    ).toThrowError(
      expect.objectContaining({
        code: "WRONG_ROLE",
      } satisfies Partial<IllegalMove>),
    );
  });

  it("allows clue text with multiple words", () => {
    const state = startTestGame();
    const spymasterId = state.turn === "red" ? "p-red-sm" : "p-blue-sm";

    const withClue = reducer(
      state,
      { type: "giveClue", word: "two word clue", count: 1 },
      spymasterId,
    );

    expect(withClue.clue?.word).toBe("two word clue");
    expect(withClue.phase).toBe("guess");
  });

  it("requires at least one guess before endTurn", () => {
    const state = startTestGame();
    const team = state.turn;
    const operativeId = team === "red" ? "p-red-op" : "p-blue-op";
    const spymasterId = team === "red" ? "p-red-sm" : "p-blue-sm";

    const guessing = reducer(
      state,
      { type: "giveClue", word: "hint", count: 2 },
      spymasterId,
    );

    expect(() =>
      reducer(guessing, { type: "endTurn" }, operativeId),
    ).toThrowError(
      expect.objectContaining({
        code: "MUST_GUESS_ONCE",
      } satisfies Partial<IllegalMove>),
    );
  });

  it("rejects bad deal", () => {
    const lobby = lobbyWithRoster();
    expect(() =>
      reducer(
        lobby,
        { type: "startGame", concepts: makeConcepts(10), seed: 1 },
        "p-red-sm",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "BAD_DEAL",
      } satisfies Partial<IllegalMove>),
    );
  });
});

describe("codenames reducer lobby", () => {
  it("allows join and assign in lobby", () => {
    let state = initialState({ roomId: "r1", lang: "ar" });
    state = reducer(state, { type: "joinRoom", name: "A" }, "p1");
    expect(state.players.p1?.team).toBe("red");

    state = reducer(
      state,
      { type: "assignSelf", team: "blue", role: "spymaster" },
      "p1",
    );
    expect(state.players.p1).toEqual({
      name: "A",
      team: "blue",
      role: "spymaster",
    });
  });
});
