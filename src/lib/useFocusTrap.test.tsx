import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function TrapHarness({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);

  return (
    <div ref={ref} data-testid="trap">
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button">last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("wraps Tab from the last element to the first", () => {
    const { getByText } = render(<TrapHarness />);
    const first = getByText("first");
    const last = getByText("last");

    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    const { getByText } = render(<TrapHarness />);
    const first = getByText("first");
    const last = getByText("last");

    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it("does nothing when inactive", () => {
    const { getByText } = render(<TrapHarness active={false} />);
    const last = getByText("last");

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });

    // No trap listener attached — focus stays put (jsdom does not move
    // focus on Tab by itself).
    expect(document.activeElement).toBe(last);
  });
});
