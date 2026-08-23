import { useEffect, useRef, useState } from "react";
import { useInstallPrompt } from "../../lib/pwa/installPrompt";
import { Button } from "./Button";

export interface InstallSheetProps {
  onClose: () => void;
}

/**
 * Platform-aware install instructions (ADR-001 §4). Reuses the game's dialog
 * chrome (`.cn-dialog-backdrop` / `.cn-dialog`).
 */
export function InstallSheet({ onClose }: InstallSheetProps) {
  const { canPrompt, prompt, isStandalone, platform } = useInstallPrompt();
  const [dismissedHint, setDismissedHint] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handlePrompt = async () => {
    const outcome = await prompt();
    if (outcome === "accepted") {
      onClose();
      return;
    }
    if (outcome === "dismissed") {
      setDismissedHint(true);
    }
  };

  return (
    <div className="cn-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="cn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-sheet-title"
        aria-describedby="install-sheet-body"
        tabIndex={-1}
      >
        <h2 id="install-sheet-title" className="text-ink m-0 text-lg font-bold">
          ثبّت اللعبة على جهازك
        </h2>

        {isStandalone ? (
          <>
            <p id="install-sheet-body" className="text-ink-soft m-0 text-sm">
              التطبيق مثبّت بالفعل ✓
            </p>
            <Button onClick={onClose}>إغلاق</Button>
          </>
        ) : (
          <>
            <p id="install-sheet-body" className="text-ink-soft m-0 text-sm">
              تعمل اللعبة كتطبيق بلا متجر: تفتح بلمسة واحدة وتعمل بسرعة.
            </p>

            {canPrompt ? (
              <>
                <Button onClick={handlePrompt}>تثبيت الآن</Button>
                {dismissedHint ? (
                  <p className="text-ink-soft m-0 text-xs">
                    يمكنك التثبيت لاحقا من هذه القائمة.
                  </p>
                ) : null}
              </>
            ) : platform === "ios" ? (
              <p className="text-ink gap-cn-2 m-0 flex items-center text-sm">
                <ShareIcon />
                افتح قائمة المشاركة في Safari ثم اختر «إضافة إلى الشاشة
                الرئيسية»
              </p>
            ) : platform === "android" ? (
              <p className="text-ink m-0 text-sm">
                من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة
                الرئيسية»
              </p>
            ) : (
              <p className="text-ink m-0 text-sm">
                اضغط أيقونة التثبيت في شريط العنوان، أو من قائمة المتصفح اختر
                «تثبيت Spymaster Mission»
              </p>
            )}

            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
