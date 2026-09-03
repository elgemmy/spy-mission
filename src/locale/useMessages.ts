import { MESSAGES, type Messages } from "./messages";
import { useUiLocale } from "./uiLocale";

export function useMessages(): Messages {
  const { locale } = useUiLocale();
  return MESSAGES[locale];
}
