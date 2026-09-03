import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayerView } from "../../engine";
import { ClueBar } from "./ClueBar";

const clueView: PlayerView = {
  roomId: "room",
  lang: "en",
  phase: "clue",
  board: [],
  turn: "red",
  clue: null,
  redRemaining: 9,
  blueRemaining: 8,
  guessesRemaining: null,
  winner: null,
  me: { id: "player", team: "red", role: "spymaster" },
  players: [],
  can: {
    joinRoom: false,
    assignSelf: false,
    setLang: false,
    startGame: false,
    giveClue: true,
    guess: false,
    endTurn: false,
  },
};

const guessView: PlayerView = {
  ...clueView,
  phase: "guess",
  clue: { word: "water", count: 2 },
  guessesRemaining: 2,
  can: { ...clueView.can, giveClue: false },
};

describe("ClueBar", () => {
  it("keeps the typed Signal when the view has not changed after submit", () => {
    render(<ClueBar view={clueView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />);

    const input = screen.getByLabelText("Signal text");
    fireEvent.change(input, { target: { value: "water" } });
    fireEvent.submit(input.closest("form")!);

    expect(input).toHaveValue("water");
  });

  it("clears the Signal once the view confirms the clue phase has ended", () => {
    const { rerender } = render(
      <ClueBar view={clueView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />,
    );

    const input = screen.getByLabelText("Signal text");
    fireEvent.change(input, { target: { value: "water" } });
    fireEvent.submit(input.closest("form")!);
    expect(input).toHaveValue("water");

    rerender(<ClueBar view={guessView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />);

    expect(screen.getByLabelText("Signal text")).toHaveValue("");
  });

  it("disables Send while the Signal text is empty or blank", () => {
    render(<ClueBar view={clueView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />);

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    const input = screen.getByLabelText("Signal text");
    fireEvent.change(input, { target: { value: "   " } });
    expect(send).toBeDisabled();

    fireEvent.change(input, { target: { value: "water" } });
    expect(send).toBeEnabled();
  });
});
