import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFocusTrap } from "../../lib/useFocusTrap";

interface AppDialogProps {
  titleId: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared modal chrome: focus trap, Escape, and restore-focus.
 * Visuals stay on `.cn-dialog` so this is not a redesign.
 */
export function AppDialog({
  titleId,
  describedBy,
  role = "dialog",
  onClose,
  children,
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  useFocusTrap(dialogRef);

  useEffect(() => {
    openerRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="cn-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="cn-dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
