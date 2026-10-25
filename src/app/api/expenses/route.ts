import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";
import { addExpenses, getCurrency, listExpenses, mergeExpenses, replaceAllExpenses } from "@/lib/db";
import { isExpense, isParsedItem } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 5000;

export async function GET() {
  const [expenses, currency] = await Promise.all([listExpenses(), getCurrency()]);
  return NextResponse.json({ expenses, currency, authEnabled: authEnabled() });
}

/** Saves newly parsed expenses: { items: ParsedItem[] }. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0 || items.length > MAX_BATCH) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  if (!items.every(isParsedItem)) {
    return NextResponse.json({ error: "Some expenses are invalid (amount, date or category)." }, { status: 400 });
  }
  const created = await addExpenses(items);
  return NextResponse.json({ expenses: created }, { status: 201 });
}

/**
 * Bulk import: { expenses: Expense[], mode: "replace" | "merge" }.
 * "replace" swaps out everything; "merge" adds rows whose ids aren't stored yet.
 */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.expenses) ? body.expenses : [];
  const mode = body?.mode === "merge" ? "merge" : "replace";
  if (rows.length > MAX_BATCH) return NextResponse.json({ error: "Too many rows." }, { status: 400 });
  const valid = rows.filter(isExpense);
  let added = valid.length;
  if (mode === "replace") await replaceAllExpenses(valid);
  else added = await mergeExpenses(valid);
  return NextResponse.json({ added, skipped: rows.length - valid.length, expenses: await listExpenses() });
}
