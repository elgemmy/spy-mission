import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FieldAgentBoard,
  PartnerFieldAgent,
  PartnerFieldAgentOnboarding,
  PartnerMissionLead,
  type FieldAgentCard,
  type MissionLeadCard,
} from ".";

const leadCards: MissionLeadCard[] = Array.from({ length: 25 }, (_, index) => ({
  id: `c${String(index + 1).padStart(2, "0")}`,
  word: `Word ${index + 1}`,
  kind: index < 8 ? "target" : index === 24 ? "trap" : "decoy",
  revealed: false,
}));

const fieldCards: FieldAgentCard[] = leadCards.map(({ id, word }) => ({
  id,
  word,
  revealed: false,
}));

describe("Partner Mission UI", () => {
  it("renders a 25-card secret map and the exact agent visibility boundary for the lead", () => {
    const { container } = render(
      <PartnerMissionLead
        locale="en"
        boardLang="en"
        phase="waiting_for_agent"
        cards={leadCards}
        targetsRemaining={8}
        fieldAgentName={null}
        signal={null}
        lockedCardIds={[]}
        inviteUrl="https://example.test/#invite=private"
        onCopyAgentInvite={vi.fn()}
        onCopyAgentBriefing={vi.fn()}
        onSendSignal={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".cn-partner-board__cell")).toHaveLength(
      25,
    );
    expect(
      screen.getByRole("button", { name: "Word 1: Target" }),
    ).toHaveAttribute("data-role", "red");
    expect(screen.getByText("✓ public words")).toBeInTheDocument();
    expect(screen.getByText("✓ revealed card results")).toBeInTheDocument();
    expect(screen.getByText("✓ current Signal and count")).toBeInTheDocument();
    expect(screen.getByText("✕ secret mission map")).toBeInTheDocument();
    expect(
      screen.getByText("✕ unrevealed classifications"),
    ).toBeInTheDocument();
  });

  it("keeps an unrevealed Field Agent card classification out of visible and accessible output", () => {
    render(
      <FieldAgentBoard
        locale="en"
        boardLang="en"
        cards={[{ id: "c01", word: "Moon", revealed: false }]}
        lockedCardIds={[]}
      />,
    );

    const card = screen.getByRole("button", { name: "Moon" });
    expect(card).toHaveAttribute("data-role", "neutral");
    expect(card).toHaveAttribute("data-view", "operative");
    expect(card).not.toHaveAccessibleName(/target|decoy|trap/i);
  });

  it("masks an authoritative result until its ordered presentation step", () => {
    const card: FieldAgentCard = {
      id: "c01",
      word: "Moon",
      revealed: true,
      result: "target",
    };
    const { rerender } = render(
      <FieldAgentBoard
        locale="en"
        boardLang="en"
        cards={[card]}
        lockedCardIds={["c01"]}
        revealSequenceCardIds={["c01"]}
        visibleRevealCount={0}
      />,
    );

    const masked = screen.getByRole("button", { name: "Moon" });
    expect(masked).not.toHaveClass("is-revealed");
    expect(masked).toHaveAttribute("data-role", "neutral");

    rerender(
      <FieldAgentBoard
        locale="en"
        boardLang="en"
        cards={[card]}
        lockedCardIds={["c01"]}
        revealSequenceCardIds={["c01"]}
        visibleRevealCount={1}
      />,
    );

    const revealed = screen.getByRole("button", { name: "Moon: Target" });
    expect(revealed).toHaveClass("is-revealed");
    expect(revealed).toHaveAttribute("data-role", "red");
  });

  it("submits only a one-word Signal with a count from 1 through 8", () => {
    const onSendSignal = vi.fn();
    render(
      <PartnerMissionLead
        locale="en"
        boardLang="en"
        phase="waiting_for_signal"
        cards={leadCards}
        targetsRemaining={8}
        fieldAgentName="Cipher"
        signal={null}
        lockedCardIds={[]}
        inviteUrl="https://example.test/#invite=private"
        onCopyAgentInvite={vi.fn()}
        onCopyAgentBriefing={vi.fn()}
        onSendSignal={onSendSignal}
      />,
    );

    const input = screen.getByLabelText("One-word Signal");
    const count = screen.getByRole("combobox", { name: "Target count" });
    const submit = screen.getByRole("button", { name: "Transmit Signal" });
    expect(within(count).getAllByRole("option")).toHaveLength(8);

    fireEvent.change(input, { target: { value: "two words" } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "orbit" } });
    fireEvent.change(count, { target: { value: "2" } });
    fireEvent.click(submit);

    expect(onSendSignal).toHaveBeenCalledWith("orbit", 2);
  });

  it("shows state-backed ordered guesses and reveal recovery controls", () => {
    const onResolve = vi.fn();
    render(
      <PartnerMissionLead
        locale="en"
        boardLang="en"
        phase="locked"
        cards={leadCards}
        targetsRemaining={8}
        fieldAgentName="Cipher"
        signal={{ word: "orbit", count: 2 }}
        lockedCardIds={["c03", "c01"]}
        presentation={{ countdownSeconds: 3 }}
        inviteUrl="https://example.test/#invite=private"
        onCopyAgentInvite={vi.fn()}
        onCopyAgentBriefing={vi.fn()}
        onSendSignal={vi.fn()}
        onResolveLockedGuesses={onResolve}
      />,
    );

    expect(screen.getByText("Revealing Cipher's guesses…")).toBeInTheDocument();
    expect(screen.getByText("Reveal begins in 3")).toBeInTheDocument();
    expect(screen.getAllByText("Word 3")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Reveal now" }));
    expect(onResolve).toHaveBeenCalledOnce();
  });

  it("reports truthful WebMCP readiness and an actionable unsupported state", () => {
    const { rerender } = render(
      <PartnerFieldAgentOnboarding
        locale="en"
        capability={{ state: "unavailable", toolCount: 0 }}
      />,
    );

    expect(screen.getByText("WebMCP unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/requires a WebMCP-capable client/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument();

    rerender(
      <PartnerFieldAgent
        locale="en"
        boardLang="en"
        phase="waiting_for_signal"
        cards={fieldCards}
        targetsRemaining={8}
        fieldAgentName="Cipher"
        signal={null}
        lockedCardIds={[]}
        capability={{ state: "ready", toolCount: 1 }}
      />,
    );

    expect(screen.getByText("WebMCP ready")).toBeInTheDocument();
    expect(screen.getByText("1 mission tool available")).toBeInTheDocument();
    expect(
      screen.getByText("Cipher is waiting for your Signal"),
    ).toBeInTheDocument();
  });

  it("uses the Arabic copy and RTL direction without changing board language", () => {
    const { container } = render(
      <PartnerFieldAgent
        locale="ar"
        boardLang="en"
        phase="waiting_for_signal"
        cards={fieldCards}
        targetsRemaining={8}
        fieldAgentName="Cipher"
        signal={null}
        lockedCardIds={[]}
        capability={{ state: "ready", toolCount: 1 }}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("العميل الميداني")).toBeInTheDocument();
    expect(screen.getAllByRole("button")[0]).toHaveAttribute("dir", "ltr");
  });
});
