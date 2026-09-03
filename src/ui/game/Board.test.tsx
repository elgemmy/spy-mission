import { fireEvent, render, screen } from "@testing-library/react";
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

  it("ignores a second confirm activation until the view reflects the reveal", () => {
    const onConfirm = vi.fn();
    const guessView: PlayerView = {
      ...baseView,
      can: { ...baseView.can, guess: true },
    };

    const { rerender } = render(
      <Board
        view={guessView}
        votes={{}}
        selectedCardIndex={0}
        onVote={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Reveal card" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();

    const revealedView: PlayerView = {
      ...guessView,
      board: [{ ...guessView.board[0]!, revealed: true }],
    };

    rerender(
      <Board
        view={revealedView}
        votes={{}}
        selectedCardIndex={0}
        onVote={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Reveal card" }),
    ).not.toBeInTheDocument();
  });

  it("re-enables confirm when the player re-taps the tile after a failed confirm", () => {
    const onConfirm = vi.fn();
    const onVote = vi.fn();
    const guessView: PlayerView = {
      ...baseView,
      can: { ...baseView.can, guess: true },
    };

    render(
      <Board
        view={guessView}
        votes={{}}
        selectedCardIndex={0}
        onVote={onVote}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole("button", { name: "Reveal card" });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();

    // The mutation failed (e.g. version conflict); the view never changed,
    // but re-tapping the same tile must still re-enable confirm.
    const tile = screen.getByRole("button", { name: "كلمة" });
    fireEvent.click(tile);

    expect(onVote).toHaveBeenCalledWith(0);
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
