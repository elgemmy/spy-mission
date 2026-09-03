/**
 * Landing copy lives in the shared UI catalog (`src/locale/messages.ts`).
 * This file keeps the existing landing import surface.
 */

import { DEMO_ROOM_CODE, MESSAGES } from "../locale/messages";
import type { LandingMessages } from "../locale/messages";
import type { UiLocale } from "../locale/uiLocale";

export type {
  FeatureKey,
  LandingOperative,
  LandingTeamStrings,
} from "../locale/messages";
export type LandingStrings = LandingMessages;
export type Lang = UiLocale;
export { DEMO_ROOM_CODE };

export const STR: Record<UiLocale, LandingMessages> = {
  ar: MESSAGES.ar.landing,
  en: MESSAGES.en.landing,
};
