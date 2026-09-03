import { useUiLocale } from "../../locale/uiLocale";
import { useMessages } from "../../locale/useMessages";

export function LocaleToggle() {
  const { locale, setLocale } = useUiLocale();
  const t = useMessages().play;

  return (
    <section className="gap-cn-2 flex flex-col" aria-label={t.interfaceLanguage}>
      <div className="flex items-center justify-between">
        <span className="text-ink text-sm font-semibold">
          {t.interfaceLanguage}
        </span>
      </div>
      <div className="cn-segmented" role="group" aria-label={t.interfaceLanguage}>
        <button
          type="button"
          aria-pressed={locale === "en"}
          onClick={() => setLocale("en")}
        >
          EN
        </button>
        <button
          type="button"
          aria-pressed={locale === "ar"}
          onClick={() => setLocale("ar")}
        >
          عربي
        </button>
      </div>
    </section>
  );
}
