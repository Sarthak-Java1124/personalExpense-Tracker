import type { Category } from "./categories";

/** A saved expense. Amounts are stored in integer minor units (paise/cents) so sums are exact. */
export interface Expense {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  description: string;
  category: Category;
  amountMinor: number;
  /** The fragment of the original sentence this expense came from. */
  sourceText: string;
  createdAt: string;
}

/** An expense extracted from text, not yet saved. */
export interface ParsedItem {
  description: string;
  category: Category;
  amountMinor: number;
  date: string;
  sourceText: string;
}

export interface ParseResponse {
  items: ParsedItem[];
  engine: "ai" | "rules";
  /** Human-readable notes: ignored fragments, AI/rules disagreements, fallbacks. */
  warnings: string[];
}
