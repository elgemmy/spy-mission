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
    render(
      <ClueBar view={clueView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />,
    );

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

    rerender(
      <ClueBar view={guessView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />,
    );

    expect(screen.getByLabelText("Signal text")).toHaveValue("");
  });

  it("disables Send while the Signal text is empty or blank", () => {
    render(
      <ClueBar view={clueView} onGiveClue={vi.fn()} onEndTurn={vi.fn()} />,
    );

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    const input = screen.getByLabelText("Signal text");
    fireEvent.change(input, { target: { value: "   " } });
    expect(send).toBeDisabled();

    fireEvent.change(input, { target: { value: "water" } });
    expect(send).toBeEnabled();
  });

  it("ignores a second submit until the view refreshes", () => {
    const onGiveClue = vi.fn();
    render(
      <ClueBar view={clueView} onGiveClue={onGiveClue} onEndTurn={vi.fn()} />,
    );

    const input = screen.getByLabelText("Signal text");
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.change(input, { target: { value: "water" } });

    fireEvent.click(send);
    fireEvent.click(send);

    expect(onGiveClue).toHaveBeenCalledTimes(1);
    expect(send).toBeDisabled();
  });

  it("re-enables Send when the word is edited after a stuck submit", () => {
    const onGiveClue = vi.fn();
    render(
      <ClueBar view={clueView} onGiveClue={onGiveClue} onEndTurn={vi.fn()} />,
    );

    const input = screen.getByLabelText("Signal text");
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.change(input, { target: { value: "water" } });
    fireEvent.click(send);
    expect(send).toBeDisabled();

    fireEvent.change(input, { target: { value: "waters" } });
    expect(send).toBeEnabled();

    fireEvent.click(send);
    expect(onGiveClue).toHaveBeenCalledTimes(2);
  });

  it("re-enables Send when the count is edited after a stuck submit", () => {
    const onGiveClue = vi.fn();
    render(
      <ClueBar view={clueView} onGiveClue={onGiveClue} onEndTurn={vi.fn()} />,
    );

    const input = screen.getByLabelText("Signal text");
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.change(input, { target: { value: "water" } });
    fireEvent.click(send);
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Guess count"), {
      target: { value: "2" },
    });
    expect(send).toBeEnabled();
  });

  it("re-enables Send when rerendered with a fresh (same-content) view", () => {
    const onGiveClue = vi.fn();
    const { rerender } = render(
      <ClueBar view={clueView} onGiveClue={onGiveClue} onEndTurn={vi.fn()} />,
    );

    const input = screen.getByLabelText("Signal text");
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.change(input, { target: { value: "water" } });
    fireEvent.click(send);
    expect(send).toBeDisabled();

    // A new poll/refresh landed but nothing actually changed content-wise —
    // still a fresh `view` object, which must release the guard.
    const refreshedView: PlayerView = { ...clueView };
    rerender(
      <ClueBar
        view={refreshedView}
        onGiveClue={onGiveClue}
        onEndTurn={vi.fn()}
      />,
    );

    expect(send).toBeEnabled();

    fireEvent.click(send);
    expect(onGiveClue).toHaveBeenCalledTimes(2);
  });
});
