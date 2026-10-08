import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HintView } from "../../room/hints";
import { HintControl } from "./HintControl";
import { useHintHeatmap } from "./useHintHeatmap";

const available: HintView = {
  used: false,
  canRequest: true,
  turnId: "turn-1",
  scores: null,
};

function HintHarness({
  hint,
  request,
  locale = "en",
}: {
  hint: HintView;
  request: () => Promise<void>;
  locale?: "en" | "ar";
}) {
  const heatmap = useHintHeatmap(hint);
  return (
    <>
      <HintControl
        hint={hint}
        locale={locale}
        visible={heatmap.visible}
        onToggle={heatmap.toggle}
        onRequestHint={request}
      />
      <output aria-label="Visible scores">
        {JSON.stringify(heatmap.scores)}
      </output>
    </>
  );
}

describe("team hint controls", () => {
  it("serializes rapid taps and toggles cached scores without another request", async () => {
    let resolve!: () => void;
    const request = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { rerender } = render(
      <HintHarness hint={available} request={request} />,
    );
    const button = screen.getByRole("button", { name: "Use team hint" });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(request).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Reading the clue…" }),
    ).toBeDisabled();
    await act(async () => resolve());
    // An accepted request stays disabled until the authoritative result arrives.
    expect(
      screen.getByRole("button", { name: "Reading the clue…" }),
    ).toBeDisabled();

    rerender(
      <HintHarness
        hint={{
          ...available,
          used: true,
          canRequest: false,
          scores: { moon: 0.9 },
        }}
        request={request}
      />,
    );
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent(
      '"moon":0.9',
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide heatmap" }));
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent("null");
    fireEvent.click(screen.getByRole("button", { name: "Show heatmap" }));
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent(
      '"moon":0.9',
    );
    expect(request).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Hide heatmap" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Clue relevance, not the chance of a safe guess."),
    ).toBeVisible();
  });

  it("expires visible scores when the turn ends while keeping the team hint spent", () => {
    const request = vi.fn();
    const { rerender } = render(
      <HintHarness
        hint={{
          ...available,
          used: true,
          canRequest: false,
          scores: { moon: 1 },
        }}
        request={request}
      />,
    );
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent(
      '"moon":1',
    );
    rerender(
      <HintHarness
        hint={{ used: true, canRequest: false, turnId: null, scores: null }}
        request={request}
      />,
    );
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent("null");
    expect(
      screen.getByRole("button", { name: "Use team hint" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Your team has used its hint for this game."),
    ).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });

  it("auto-shows fresh results after a previously hidden turn", () => {
    const request = vi.fn();
    const { rerender } = render(
      <HintHarness
        hint={{
          ...available,
          used: true,
          canRequest: false,
          scores: { moon: 1 },
        }}
        request={request}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide heatmap" }));
    rerender(
      <HintHarness
        hint={{ used: true, canRequest: false, turnId: null, scores: null }}
        request={request}
      />,
    );
    rerender(
      <HintHarness
        hint={{
          used: true,
          canRequest: false,
          turnId: "new-game-turn-1",
          scores: { moon: 0.5 },
        }}
        request={request}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Hide heatmap" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Visible scores")).toHaveTextContent(
      '"moon":0.5',
    );
  });

  it("disables the hint while waiting for a clue", () => {
    render(
      <HintHarness
        hint={{ ...available, canRequest: false, turnId: null }}
        request={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Use team hint" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Available when your team has an active clue."),
    ).toBeVisible();
  });

  it("shows a clear configuration error and leaves retries available", async () => {
    const request = vi.fn().mockRejectedValue(new Error("HINT_NOT_CONFIGURED"));
    render(<HintHarness hint={available} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Use team hint" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hints aren't configured yet. Your team's hint is still available.",
    );
    expect(screen.getByRole("button", { name: "Use team hint" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Use team hint" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("localizes controls, legend, and retry failures in Arabic", async () => {
    const request = vi.fn().mockRejectedValue(new Error("HINT_TIMEOUT"));
    const { rerender } = render(
      <HintHarness hint={available} request={request} locale="ar" />,
    );
    expect(
      screen.getByRole("region", { name: "خريطة ارتباط الكلمات" }),
    ).toHaveAttribute("dir", "rtl");
    fireEvent.click(
      screen.getByRole("button", { name: "استخدم مساعدة الفريق" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "تعذّر تحميل المساعدة. حاول مرة أخرى.",
    );
    rerender(
      <HintHarness
        hint={{
          ...available,
          used: true,
          canRequest: false,
          scores: { moon: 0.5 },
        }}
        request={request}
        locale="ar"
      />,
    );
    expect(screen.getByRole("button", { name: "إخفاء الخريطة" })).toBeEnabled();
    expect(
      screen.getByText("الارتباط بالتلميح، وليس احتمال التخمين الآمن."),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
