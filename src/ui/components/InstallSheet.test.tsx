import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallSheet } from "./InstallSheet";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  });
}

function fireBeforeInstallPrompt(
  outcome: "accepted" | "dismissed" = "accepted",
) {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & {
    platforms: readonly string[];
    userChoice: Promise<{ outcome: typeof outcome; platform: string }>;
    prompt: () => Promise<void>;
  };
  event.platforms = ["web"];
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  event.prompt = vi.fn(async () => undefined);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const originalUserAgent = window.navigator.userAgent;

afterEach(() => {
  setUserAgent(originalUserAgent);
  // Clear any event still held by the module-level capture.
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
});

describe("InstallSheet", () => {
  it("renders iOS instructions when the platform is iOS", () => {
    setUserAgent(IOS_UA);

    render(<InstallSheet onClose={vi.fn()} />);

    expect(
      screen.getByText(/افتح قائمة المشاركة في Safari/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "تثبيت الآن" }),
    ).not.toBeInTheDocument();
  });

  it("renders the prompt button when a beforeinstallprompt event was captured", () => {
    render(<InstallSheet onClose={vi.fn()} />);
    fireBeforeInstallPrompt();

    expect(
      screen.getByRole("button", { name: "تثبيت الآن" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<InstallSheet onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has dialog semantics", () => {
    render(<InstallSheet onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "install-sheet-title");
    expect(dialog).toHaveAttribute("aria-describedby", "install-sheet-body");
  });
});
