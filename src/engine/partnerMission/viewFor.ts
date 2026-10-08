import { partnerPlayers, partnerRoleFor, partnerTeamReady } from "./team.js";
import type {
  PartnerFieldAgentView,
  PartnerFieldCard,
  PartnerLeadCard,
  PartnerMissionCapabilities,
  PartnerMissionState,
  PartnerMissionView,
} from "./types.js";

function targetsRemaining(state: PartnerMissionState): number {
  return state.board.filter((card) => card.kind === "target" && !card.revealed)
    .length;
}

function capabilities(
  state: PartnerMissionState,
  viewerRole: "mission_lead" | "field_agent" | null,
): PartnerMissionCapabilities {
  return {
    ...(state.partnerType === "human"
      ? {
          startPartnerMission:
            viewerRole === "mission_lead" &&
            state.phase === "waiting_for_agent" &&
            partnerTeamReady(state),
        }
      : {}),
    claimFieldAgent:
      viewerRole === null &&
      (state.partnerType === "human"
        ? state.phase !== "won" && state.phase !== "lost"
        : state.fieldAgent === null && state.phase === "waiting_for_agent"),
    giveSignal:
      viewerRole === "mission_lead" && state.phase === "waiting_for_signal",
    lockGuesses:
      viewerRole === "field_agent" && state.phase === "field_agent_turn",
    resolveLockedGuesses:
      viewerRole === "mission_lead" && state.phase === "locked",
  };
}

function leadBoard(state: PartnerMissionState): PartnerLeadCard[] {
  return state.board.map(({ id, concept, revealed, kind }) => ({
    id,
    concept,
    revealed,
    kind,
  }));
}

function fieldBoard(state: PartnerMissionState): PartnerFieldCard[] {
  return state.board.map(({ id, concept, revealed, kind }) =>
    revealed
      ? { id, concept, revealed: true, result: kind }
      : { id, concept, revealed: false },
  );
}

function activeMaxGuesses(state: PartnerMissionState): number | null {
  return state.signal ? state.signal.count + 1 : null;
}

export function partnerMissionViewFor(
  state: PartnerMissionState,
  actorId: string,
): PartnerMissionView {
  const viewerRole = partnerRoleFor(state, actorId);

  if (viewerRole === null) {
    return {
      roomId: state.roomId,
      lang: state.lang,
      phase: state.phase,
      viewerRole,
      missionLeadName: state.missionLead.name,
      fieldAgentName: state.fieldAgent?.name ?? null,
      seatAvailable: capabilities(state, viewerRole).claimFieldAgent,
      can: capabilities(state, viewerRole),
    };
  }

  const common = {
    ...(state.partnerType === "human"
      ? { team: partnerPlayers(state).map((player) => ({ ...player })) }
      : {}),
    roomId: state.roomId,
    lang: state.lang,
    phase: state.phase,
    missionLeadName: state.missionLead.name,
    fieldAgentName: state.fieldAgent?.name ?? null,
    targetsRemaining: targetsRemaining(state),
    signal: state.signal,
    lockedCardIds: state.lockedGuesses ? [...state.lockedGuesses.cardIds] : [],
    previousTurn: state.previousTurn,
    turnNumber: state.turnNumber,
    maxGuesses: activeMaxGuesses(state),
    can: capabilities(state, viewerRole),
  };

  if (viewerRole === "mission_lead") {
    return { ...common, viewerRole, board: leadBoard(state) };
  }

  return {
    ...common,
    viewerRole,
    board: fieldBoard(state),
  } satisfies PartnerFieldAgentView;
}
