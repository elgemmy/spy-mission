import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayerView } from "../../engine";
import { Board } from "./Board";

const baseView: PlayerView = {
  roomId: "room",
  lang: "ar",
  phase: "guess",
  board: [
    {
      concept: { id: "word-1", ar: "كلمة", en: "word" },
      revealed: false,
      kind: null,
    },
  ],
  turn: "red",
  clue: null,
  redRemaining: 1,
  blueRemaining: 1,
  guessesRemaining: null,
  winner: null,
  me: { id: "player", team: "red", role: "operative" },
  players: [],
  can: {
    joinRoom: false,
    assignSelf: false,
    setLang: false,
    startGame: false,
    giveClue: false,
    guess: false,
    endTurn: false,
  },
};

describe("Board", () => {
  it("uses key-tint card view for everyone after the game ends", () => {
    const endedView: PlayerView = {
      ...baseView,
      phase: "ended",
      winner: "blue",
      board: [{ ...baseView.board[0]!, kind: "blue" }],
    };

    render(
      <Board
        view={endedView}
        votes={{}}
        selectedCardIndex={null}
        onVote={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const card = screen.getByRole("button", { name: "كلمة" });
    expect(card).toHaveAttribute("data-view", "spymaster");
    expect(card).toHaveAttribute("data-role", "blue");
  });
});
