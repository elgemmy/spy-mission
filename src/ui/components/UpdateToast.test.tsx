import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES } from "../../locale/messages";
import { UiLocaleProvider } from "../../locale/UiLocaleProvider";
import { setNeedRefresh } from "../../lib/pwa/serviceWorker";
import { UpdateToast } from "./UpdateToast";

const en = MESSAGES.en.play;

describe("UpdateToast", () => {
  it("shows the update copy and status role", () => {
    render(
      <UiLocaleProvider>
        <UpdateToast />
      </UiLocaleProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(en.updateReady);
  });

  it("calls the pending update function when Update is clicked", async () => {
    const update = vi.fn(async () => undefined);
    act(() => {
      setNeedRefresh(update);
    });

    render(
      <UiLocaleProvider>
        <UpdateToast />
      </UiLocaleProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.updateNow }));
    });

    expect(update).toHaveBeenCalledOnce();
  });
});
