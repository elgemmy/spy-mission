import { applyUpdate, dismissRefresh } from "../../lib/pwa/serviceWorker";
import { Button } from "./Button";

/**
 * Non-modal toast shown when a new service worker is waiting (ADR-001 §4,
 * `registerType: "prompt"` — updates never reload mid-game on their own).
 */
export function UpdateToast() {
  return (
    <div className="cn-update-toast" role="status">
      <p className="text-ink m-0 text-sm font-semibold">
        يتوفر تحديث جديد للعبة
      </p>
      <div className="gap-cn-2 flex">
        <Button onClick={() => void applyUpdate()}>تحديث</Button>
        <Button variant="secondary" onClick={dismissRefresh}>
          لاحقًا
        </Button>
      </div>
    </div>
  );
}
