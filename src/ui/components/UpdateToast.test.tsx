import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setNeedRefresh } from "../../lib/pwa/serviceWorker";
import { UpdateToast } from "./UpdateToast";

describe("UpdateToast", () => {
  it("shows the update copy and status role", () => {
    render(<UpdateToast />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "يتوفر تحديث جديد للعبة",
    );
  });

  it("calls the pending update function when 'تحديث' is clicked", async () => {
    const update = vi.fn(async () => undefined);
    act(() => {
      setNeedRefresh(update);
    });

    render(<UpdateToast />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تحديث" }));
    });

    expect(update).toHaveBeenCalledOnce();
  });
});
