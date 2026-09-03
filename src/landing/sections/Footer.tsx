import { playUrl } from "../../config/routes";
import { Mark } from "../../ui/components/Mark";
import type { LandingStrings } from "../strings";

export interface FooterProps {
  t: LandingStrings;
  hostLabel: string;
}

export function Footer({ t, hostLabel }: FooterProps) {
  return (
    <footer className="cn-lp-footer">
      <div className="cn-lp-wrap cn-lp-footer__inner">
        <Mark size={24} />
        <span className="cn-lp-wordmark cn-lp-wordmark--footer">
          {t.productName}
        </span>
        <span className="cn-lp-footer__sep" aria-hidden="true">
          ·
        </span>
        <span className="cn-lp-footer__credit">{t.credit}</span>
        <span className="cn-lp-footer__legal" dir="ltr">
          {"© 2026 · "}
          <a className="cn-lp-hostlink" href={playUrl()}>
            {hostLabel}
          </a>
        </span>
      </div>
    </footer>
  );
}
