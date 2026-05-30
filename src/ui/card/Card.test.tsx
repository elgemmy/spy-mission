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
});
