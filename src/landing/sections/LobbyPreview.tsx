import { useEffect, useState } from "react";
import { GlyphIcon } from "../../ui/card/glyphs";
import type { CardRole } from "../../ui/card/types";
import { EyeMark } from "../../ui/components/EyeMark";
import { Mark } from "../../ui/components/Mark";
import {
  DEMO_ROOM_CODE,
  STR,
  type Lang,
  type LandingOperative,
  type LandingTeamStrings,
} from "../strings";
import { dirFor } from "../useLang";

const COPIED_MS = 1600;

function CheckIcon() {
  return (
    <svg
      className="cn-lp-lobby__copy-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12.5l4.2 4.2L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="cn-lp-lobby__copy-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15.5V6a2.5 2.5 0 012.5-2.5H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayerChip({
  player,
  youLabel,
}: {
  player: LandingOperative;
  youLabel: string;
}) {
  return (
    <span className="cn-lp-player">
      <span className="cn-lp-player__avatar" aria-hidden="true">
        {player.name.slice(0, 1)}
      </span>
      <span className="cn-lp-player__name">{player.name}</span>
      {player.you ? (
        <span className="cn-lp-player__you">{youLabel}</span>
      ) : null}
    </span>
  );
}

function TeamCard({
  role,
  team,
  spymasterLabel,
  youLabel,
}: {
  role: CardRole;
  team: LandingTeamStrings;
  spymasterLabel: string;
  youLabel: string;
}) {
  return (
    <div className="cn-lp-team cn-lp-role" data-role={role}>
      <div className="cn-lp-team__head">
        <GlyphIcon role={role} className="cn-lp-team__glyph" />
        <span className="cn-lp-team__title">{team.title}</span>
        <span className="cn-lp-team__count">{1 + team.operatives.length}</span>
      </div>

      <div className="cn-lp-team__spymaster">
        <EyeMark size={17} color={`var(--cn-${role}-ink)`} />
        <span className="cn-lp-team__spymaster-text">
          <span className="cn-lp-team__spymaster-name">{team.spymaster}</span>
          <span className="cn-lp-team__spymaster-label">{spymasterLabel}</span>
        </span>
      </div>

      <div className="cn-lp-team__players">
        {team.operatives.map((player) => (
          <PlayerChip key={player.name} player={player} youLabel={youLabel} />
        ))}
      </div>

      <span className="cn-lp-team__join" aria-hidden="true">
        {team.join}
      </span>
    </div>
  );
}

export interface LobbyPreviewProps {
  /** Page language — seeds the preview's own board language. */
  lang: Lang;
}

/** The lobby screen, with a working copy button and language segment. */
export function LobbyPreview({ lang }: LobbyPreviewProps) {
  // Seeded from the page language; the parent re-keys on a page toggle so
  // both phones keep telling the same story.
  const [lng, setLng] = useState<Lang>(lang);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const t = STR[lng].lobby;

  const copy = () => {
    try {
      void navigator.clipboard
        ?.writeText(DEMO_ROOM_CODE)
        .then(() => setCopied(true))
        .catch(() => {});
    } catch {
      // Clipboard access is a nicety here; the code is visible either way.
    }
  };

  return (
    <div className="cn-lp-lobby" data-lang={lng} dir={dirFor(lng)}>
      <div className="cn-lp-lobby__head">
        <Mark size={32} />
        <span className="cn-lp-lobby__titles">
          <span className="cn-lp-lobby__title">{t.title}</span>
          <span className="cn-lp-lobby__subtitle">{t.subtitle}</span>
        </span>
        <span className="cn-lp-lobby__presence">
          <span className="cn-lp-lobby__dot" aria-hidden="true" />
          {t.online}
        </span>
      </div>

      <div className="cn-lp-lobby__codecard">
        <p className="cn-lp-label">{t.codeLabel}</p>
        <div className="cn-lp-lobby__coderow">
          <span className="cn-lp-lobby__code" dir="ltr">
            {DEMO_ROOM_CODE}
          </span>
          <button
            type="button"
            className="cn-lp-lobby__copy"
            data-copied={copied ? "true" : "false"}
            onClick={copy}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <p className="cn-lp-lobby__hint">{t.shareHint}</p>
      </div>

      <div className="cn-lp-lobby__langblock">
        <p className="cn-lp-label">{t.boardLangLabel}</p>
        <div className="cn-lp-seg" role="group" aria-label={t.boardLangGroup}>
          <button
            type="button"
            className="cn-lp-seg__btn"
            aria-pressed={lng === "ar"}
            onClick={() => setLng("ar")}
          >
            {t.boardLangAr}
          </button>
          <button
            type="button"
            className="cn-lp-seg__btn"
            aria-pressed={lng === "en"}
            onClick={() => setLng("en")}
          >
            {t.boardLangEn}
          </button>
        </div>
      </div>

      <div className="cn-lp-lobby__teams">
        <TeamCard
          role="red"
          team={t.red}
          spymasterLabel={t.spymasterLabel}
          youLabel={t.you}
        />
        <TeamCard
          role="blue"
          team={t.blue}
          spymasterLabel={t.spymasterLabel}
          youLabel={t.you}
        />
      </div>

      <span className="cn-lp-lobby__start" aria-hidden="true">
        {t.start}
      </span>
    </div>
  );
}
