import type { PlayerView, Role, Team } from "../engine";

export interface StartSeat {
  team: Team;
  role: Role;
}

export interface StartReadiness {
  canStart: boolean;
  isHost: boolean;
  missing: StartSeat[];
}

const REQUIRED_SEATS: readonly StartSeat[] = [
  { team: "red", role: "spymaster" },
  { team: "red", role: "operative" },
  { team: "blue", role: "spymaster" },
  { team: "blue", role: "operative" },
];

export function missingStartSeats(view: PlayerView): StartSeat[] {
  return REQUIRED_SEATS.filter(
    (seat) =>
      !view.players.some(
        (player) => player.team === seat.team && player.role === seat.role,
      ),
  );
}

export function startReadiness(
  view: PlayerView,
  isHost: boolean,
): StartReadiness {
  const missing = missingStartSeats(view);
  return {
    canStart: isHost && missing.length === 0 && view.can.startGame,
    isHost,
    missing,
  };
}
