import type { Category } from "./categories";
import { addDays } from "./dates";
import { sumMinor } from "./money";
import type { Expense } from "./types";

/** Expenses whose date falls in [start, end] inclusive (ISO strings compare lexically). */
export function inRange(expenses: Expense[], start: string, end: string): Expense[] {
  return expenses.filter((e) => e.date >= start && e.date <= end);
}

export function total(expenses: Expense[]): number {
  return sumMinor(expenses.map((e) => e.amountMinor));
}

export function byCategory(expenses: Expense[]): { category: Category; amountMinor: number; count: number }[] {
  const map = new Map<Category, { amountMinor: number; count: number }>();
  for (const e of expenses) {
    const row = map.get(e.category) ?? { amountMinor: 0, count: 0 };
    row.amountMinor += e.amountMinor;
    row.count += 1;
    map.set(e.category, row);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function byDay(expenses: Expense[], start: string, days: number): { date: string; amountMinor: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.date, (totals.get(e.date) ?? 0) + e.amountMinor);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { date, amountMinor: totals.get(date) ?? 0 };
  });
}
