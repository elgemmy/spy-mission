import type { Concept } from "../../engine";

export interface WordCategory {
  category: string;
  concepts: Concept[];
}
