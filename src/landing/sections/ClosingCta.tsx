import { playUrl } from "../../config/routes";
import { useInstallPrompt } from "../../lib/pwa/installPrompt";
import type { LandingStrings } from "../strings";

export interface ClosingCtaProps {
  t: LandingStrings;
  hostLabel: string;
}

export function ClosingCta({ t, hostLabel }: ClosingCtaProps) {
  const { canPrompt, prompt, isStandalone } = useInstallPrompt();

  // Installing from here installs the *game* (manifest scope `/play/`).
  const install = async () => {
    if (canPrompt) {
      await prompt();
      return;
    }
    window.location.assign(playUrl({ install: true }));
  };

  return (
    <section className="cn-lp-closing">
      <h2 className="cn-lp-closing__title">{t.ctaTitle}</h2>
      <p className="cn-lp-closing__sub">{t.ctaSub}</p>
      <div className="cn-lp-closing__row">
        <a
          className="cn-lp-btn cn-lp-btn--primary cn-lp-btn--closing"
          href={playUrl({ create: true })}
        >
          {t.play}
        </a>
        {isStandalone ? null : (
          <button
            type="button"
            className="cn-lp-btn cn-lp-btn--secondary cn-lp-btn--closing"
            onClick={() => void install()}
          >
            {t.install}
          </button>
        )}
      </div>
      <p className="cn-lp-hostline cn-lp-hostline--closing" dir="ltr">
        <a className="cn-lp-hostlink" href={playUrl()}>
          {hostLabel}
        </a>
      </p>
    </section>
  );
}
