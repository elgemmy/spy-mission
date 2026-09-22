import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlyphDefs, WordCard } from "./index";

describe("WordCard", () => {
  it("renders the word on front and back faces", () => {
    render(
      <>
        <GlyphDefs />
        <WordCard word="قطار" role="red" view="operative" lang="ar" />
      </>,
    );

    const words = screen.getAllByText("قطار");
    expect(words.length).toBeGreaterThanOrEqual(2);
  });

  it("applies is-revealed when revealed prop is true", () => {
    const { container } = render(
      <WordCard word="نار" role="red" view="operative" revealed lang="ar" />,
    );

    expect(container.querySelector(".cn-card")).toHaveClass("is-revealed");
  });

  it("sets data-role and data-view attributes", () => {
    const { container } = render(
      <WordCard word="بحر" role="blue" view="spymaster" lang="ar" />,
    );

    const card = container.querySelector(".cn-card");
    expect(card).toHaveAttribute("data-role", "blue");
    expect(card).toHaveAttribute("data-view", "spymaster");
  });

  it("applies Arabic typography class for ar lang", () => {
    const { container } = render(
      <WordCard word="قمر" role="neutral" view="operative" lang="ar" />,
    );

    expect(container.querySelector(".cn-card")).toHaveClass("cn-card--ar");
  });

  it("calls onClick when tapped", () => {
    const onClick = vi.fn();

    render(
      <WordCard
        word="باب"
        role="blue"
        view="operative"
        lang="ar"
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    [0, "0%", "var(--cn-hint-low)"],
    [0.5, "50%", "var(--cn-hint-mid)"],
    [1, "100%", "var(--cn-hint-high)"],
  ])(
    "shows numeric relevance and the correct heatmap anchor for %s",
    (score, label, color) => {
      render(
        <WordCard
          word="Moon"
          role="neutral"
          view="operative"
          lang="en"
          hintScore={score as number}
        />,
      );
      const card = screen.getByRole("button", {
        name: `Moon: ${label} clue relevance`,
      });
      expect(card).toHaveClass("has-hint");
      expect(card.style.getPropertyValue("--cn-hint-color")).toBe(color);
      expect(screen.getByText(label)).toBeVisible();
      expect(card).toHaveAttribute("data-role", "neutral");
    },
  );

  it("preserves revealed result colors and keeps the heatmap out of Mission Lead views", () => {
    const { rerender } = render(
      <WordCard
        word="Moon"
        role="assassin"
        view="operative"
        revealed
        lang="en"
        hintScore={1}
      />,
    );
    const card = screen.getByRole("button");
    expect(card).toHaveClass("is-revealed");
    expect(card).not.toHaveClass("has-hint");
    expect(card).toHaveAttribute("data-role", "assassin");
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    rerender(
      <WordCard
        word="Moon"
        role="red"
        view="spymaster"
        lang="en"
        hintScore={1}
      />,
    );
    expect(card).not.toHaveClass("has-hint");
  });

  it("uses the interface locale for score labels independently of the board language", () => {
    render(
      <WordCard
        word="Moon"
        role="neutral"
        view="operative"
        lang="en"
        hintLocale="ar"
        hintScore={0.5}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Moon: نسبة الارتباط بالتلميح/ }),
    ).toHaveAttribute("dir", "ltr");
  });
});
