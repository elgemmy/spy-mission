export function buildAgentBriefing(inviteUrl: string): string {
  const invitation = inviteUrl.trim();
  if (!invitation) {
    throw new Error("A Field Agent invitation URL is required.");
  }

  return [
    "You are the Field Agent in a Spy Mission AI Partner Mission.",
    `Open this Field Agent invitation: ${invitation}`,
    "Use the page's WebMCP tools. Do not replace them with DOM scraping when WebMCP is available.",
    "Before joining, choose_name is available so you can choose a short name and claim the Field Agent seat.",
    "After joining, inspect_mission is the public-state inspector. It returns the current phase, Signal, public cards, revealed results, stable card IDs, targets remaining, and max_guesses when guessing is allowed.",
    "submit_guesses appears only while a Signal is active. Reinspect immediately before submitting, use stable IDs from that latest inspection, order guesses strongest-first, and treat max_guesses as the authoritative limit.",
    "Previous Signals remain useful semantic context for unrevealed words on later turns, especially when earlier guesses ended early. Use them together with the current Signal when reasoning, but only the current Signal's max_guesses controls how many guesses may be submitted.",
    "While the Mission Lead is acting, wait briefly and call inspect_mission again. After each reveal, inspect again and continue until the mission is won or lost.",
    "Reason from public Signals and board state to choose likely Targets, but never access, request, scrape, or claim knowledge of the actual unrevealed Target/Decoy/Trap classifications or secret mission map.",
  ].join("\n");
}
