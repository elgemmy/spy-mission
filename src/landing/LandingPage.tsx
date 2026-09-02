import { GlyphDefs } from "../ui/card/glyphs";
import "./Landing.css";
import { useHostLabel } from "./hostLabel";
import { ClosingCta } from "./sections/ClosingCta";
import { Features } from "./sections/Features";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { HoverRow } from "./sections/HoverRow";
import { HowToPlay } from "./sections/HowToPlay";
import { Nav } from "./sections/Nav";
import { Screens } from "./sections/Screens";
import { STR } from "./strings";
import { useLang } from "./useLang";

export function LandingPage() {
  const { lang, dir, setLang } = useLang();
  const t = STR[lang];
  const hostLabel = useHostLabel();

  return (
    <div className="cn-lp" data-lang={lang} dir={dir}>
      <GlyphDefs />
      <Nav lang={lang} onLangChange={setLang} t={t} />
      <main>
        <Hero lang={lang} t={t} hostLabel={hostLabel} />
        <HoverRow key={lang} lang={lang} />
        <HowToPlay lang={lang} t={t} />
        <Features t={t} />
        <Screens lang={lang} t={t} />
        <ClosingCta t={t} hostLabel={hostLabel} />
      </main>
      <Footer t={t} hostLabel={hostLabel} />
    </div>
  );
}
