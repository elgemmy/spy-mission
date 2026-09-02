import type { ReactNode } from "react";
import type { Lang, LandingStrings } from "../strings";
import { dirFor } from "../useLang";
import { BoardPreview } from "./BoardPreview";
import { LobbyPreview } from "./LobbyPreview";

/** Fixed height for the in-game phone so the clue bar sits on the bottom. */
const BOARD_SCREEN_HEIGHT = 664;

function StatusMini({ lang }: { lang: Lang }) {
  return (
    <div className="cn-lp-status" dir={dirFor(lang)} aria-hidden="true">
      <span className="cn-lp-status__time">9:41</span>
      <span className="cn-lp-status__right">
        <span className="cn-lp-status__signal">●●●</span>
        <span className="cn-lp-status__battery">
          <span className="cn-lp-status__battery-fill" />
        </span>
      </span>
    </div>
  );
}

function PhoneFrame({
  label,
  lang,
  height,
  children,
}: {
  label: string;
  lang: Lang;
  height?: number;
  children: ReactNode;
}) {
  return (
    <figure className="cn-lp-phone">
      <div className="cn-lp-phone__shell">
        <div
          className="cn-lp-phone__screen"
          style={height ? { height, minHeight: height } : undefined}
        >
          <StatusMini lang={lang} />
          <div className="cn-lp-phone__body">{children}</div>
        </div>
      </div>
      <figcaption className="cn-lp-phone__caption">{label}</figcaption>
    </figure>
  );
}

export interface ScreensProps {
  lang: Lang;
  t: LandingStrings;
}

export function Screens({ lang, t }: ScreensProps) {
  return (
    <section className="cn-lp-wrap cn-lp-section cn-lp-section--screens">
      <h2 className="cn-lp-h2">{t.screensTitle}</h2>
      <div className="cn-lp-phones">
        <PhoneFrame label={t.screens[0]} lang={lang}>
          <LobbyPreview key={lang} lang={lang} />
        </PhoneFrame>
        <PhoneFrame
          label={t.screens[1]}
          lang={lang}
          height={BOARD_SCREEN_HEIGHT}
        >
          <BoardPreview key={lang} lang={lang} t={t} />
        </PhoneFrame>
      </div>
    </section>
  );
}
