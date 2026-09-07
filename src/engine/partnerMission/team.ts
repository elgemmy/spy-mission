import type { PartnerMissionState, PartnerTeamPlayer } from "./types.js";

export function partnerPlayers(
  state: PartnerMissionState,
): PartnerTeamPlayer[] {
  if (state.partnerType === "human" && state.team) return state.team;
  return [
    { ...state.missionLead, role: "mission_lead" },
    ...(state.fieldAgent
      ? [{ ...state.fieldAgent, role: "field_agent" as const }]
      : []),
  ];
}

export function partnerRoleFor(state: PartnerMissionState, actorId: string) {
  return (
    partnerPlayers(state).find((player) => player.id === actorId)?.role ?? null
  );
}

export function partnerTeamReady(state: PartnerMissionState): boolean {
  const players = partnerPlayers(state);
  return (
    players.some((player) => player.role === "mission_lead") &&
    players.some((player) => player.role === "field_agent")
  );
}
