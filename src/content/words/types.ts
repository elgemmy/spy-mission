import type { Concept } from "../../engine/index.js";

export interface WordCategory {
  category: string;
  concepts: Concept[];
}
