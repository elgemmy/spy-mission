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
    "While the Mission Lead is acting, wait briefly and call inspect_mission again. After each reveal, inspect again and continue until the mission is won or lost.",
    "Reason only from public Field Agent state. Never request, scrape, or infer hidden card classifications or the secret mission map.",
  ].join("\n");
}
