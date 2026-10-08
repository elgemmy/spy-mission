import type {
  PartnerTeamPlayer,
  PartnerMissionPhase,
} from "../../engine/partnerMission";
import { Button } from "../components/Button";
import { DUO_MESSAGES, PARTNER_MESSAGES } from "./strings";

export function CoopTeam({
  locale,
  team,
  phase,
  isLead,
  canStart,
  pending,
  onStart,
  onCopyInvite,
  copied,
}: {
  locale: "en" | "ar";
  team: readonly PartnerTeamPlayer[];
  phase: PartnerMissionPhase;
  isLead: boolean;
  canStart: boolean;
  pending: boolean;
  onStart: () => void;
  onCopyInvite?: () => void;
  copied: boolean;
}) {
  const t = DUO_MESSAGES[locale];
  const waiting = phase === "waiting_for_agent";
  const ended = phase === "won" || phase === "lost";
  return (
    <section className="cn-partner-panel" aria-label={t.team}>
      <p className="cn-partner-eyebrow">
        {t.team} · {team.length}
      </p>
      {(["mission_lead", "field_agent"] as const).map((role) => (
        <div key={role}>
          <strong>{role === "mission_lead" ? t.leads : t.agents}</strong>
          <ul className="cn-partner-guess-list">
            {team
              .filter((player) => player.role === role)
              .map((player) => (
                <li key={player.id}>{player.name}</li>
              ))}
          </ul>
        </div>
      ))}
      {!ended ? (
        <>
          <p className="cn-partner-muted">
            {waiting ? t.minimumTeam : t.sharedTurn}
          </p>
          <div className="cn-partner-actions">
            {onCopyInvite ? (
              <Button variant="secondary" onClick={onCopyInvite}>
                {copied
                  ? PARTNER_MESSAGES[locale].inviteCopied
                  : t.copyAgentInvite}
              </Button>
            ) : null}
            {waiting && isLead ? (
              <Button onClick={onStart} disabled={!canStart || pending}>
                {t.startMission}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
