import { useEffect, useState } from "react";
import { GlyphDefs, WordCard, type CardRole, type CardView } from "../ui/card";
import { initTheme } from "./theme";

type LegendItem = {
  word: string;
  role: CardRole;
  view: CardView;
  revealed: boolean;
  caption: string;
};

const DEMO_WORDS: Array<[string, CardRole]> = [
  ["قطار", "red"],
  ["بحر", "blue"],
  ["نجمة", "neutral"],
  ["قمر", "red"],
  ["باب", "blue"],
];

const LEGEND: LegendItem[] = [
  { word: "قطار", role: "neutral", view: "operative", revealed: false, caption: "مغلقة · لاعب" },
  { word: "بحر", role: "blue", view: "spymaster", revealed: false, caption: "مفتاح · سيّد" },
  { word: "نار", role: "red", view: "operative", revealed: true, caption: "عميل أحمر" },
  { word: "قمر", role: "blue", view: "operative", revealed: true, caption: "عميل أزرق" },
  { word: "باب", role: "neutral", view: "operative", revealed: true, caption: "مارّ" },
  { word: "سيف", role: "assassin", view: "operative", revealed: true, caption: "القاتل" },
];

export function App() {
  const [revealedDemo, setRevealedDemo] = useState<Record<number, boolean>>({});

  useEffect(() => {
    initTheme("default");
  }, []);

  const toggleDemo = (index: number) => {
    setRevealedDemo((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  return (
    <div className="cn-shell font-ui text-ink">
      <GlyphDefs />

      <div className="p-cn-4 pb-cn-7">
        <header className="mb-cn-5 text-center">
          <h1 className="text-xl font-semibold">البطاقة — مرجع التصميم</h1>
          <p className="mt-1 text-sm text-ink-soft">
            اضغط أي بطاقة في الصف التجريبي للقلب. Design foundation preview.
          </p>
        </header>

        <section aria-label="صف تجريبي">
          <div className="grid grid-cols-5 gap-cn-2 px-cn-3 pb-cn-3">
            {DEMO_WORDS.map(([word, role], index) => (
              <WordCard
                key={`${word}-${index}`}
                word={word}
                role={role}
                view="operative"
                lang="ar"
                revealed={Boolean(revealedDemo[index])}
                onClick={() => toggleDemo(index)}
              />
            ))}
          </div>
        </section>

        <section aria-label="حالات مرجعية" className="mt-cn-6">
          <div className="grid grid-cols-3 gap-cn-4">
            {LEGEND.map((item) => (
              <figure key={item.caption} className="m-0 flex flex-col items-center gap-cn-2">
                <WordCard
                  word={item.word}
                  role={item.role}
                  view={item.view}
                  lang="ar"
                  revealed={item.revealed}
                  disabled
                  aria-label={item.caption}
                />
                <figcaption className="text-center text-xs font-semibold text-ink-soft">
                  {item.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <p className="mt-cn-5 text-center text-sm text-ink-soft">
          المصدر: <code className="font-mono text-xs">docs/handoff/</code>
        </p>
      </div>
    </div>
  );
}
