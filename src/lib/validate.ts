import { isCategory } from "./categories";
import { isISODate } from "./dates";
import type { Expense, ParsedItem } from "./types";

const MAX_TEXT = 500;
/** 10 crore in minor units; anything larger is almost certainly a typo. */
const MAX_AMOUNT_MINOR = 100_000_000_00;

export function isParsedItem(value: unknown): value is ParsedItem {
  const e = value as ParsedItem;
  return (
    typeof e === "object" && e !== null &&
    typeof e.description === "string" && e.description.length <= MAX_TEXT &&
    typeof e.sourceText === "string" && e.sourceText.length <= MAX_TEXT * 10 &&
    typeof e.amountMinor === "number" && Number.isInteger(e.amountMinor) &&
    e.amountMinor > 0 && e.amountMinor <= MAX_AMOUNT_MINOR &&
    typeof e.date === "string" && isISODate(e.date) &&
    typeof e.category === "string" && isCategory(e.category)
  );
}

export function isExpense(value: unknown): value is Expense {
  const e = value as Expense;
  return (
    isParsedItem(value) &&
    typeof e.id === "string" && e.id.length > 0 && e.id.length <= 100 &&
    typeof e.createdAt === "string"
  );
}
