import { NextResponse } from "next/server";
import { deleteExpense, updateExpense } from "@/lib/db";
import { isParsedItem } from "@/lib/validate";
import type { ParsedItem } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const patch: Partial<ParsedItem> = {};
  for (const key of ["date", "description", "category", "amountMinor", "sourceText"] as const) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }
  // Validate the patched fields by checking them on a complete placeholder record.
  const probe = { description: "x", category: "Other", amountMinor: 1, date: "2000-01-01", sourceText: "", ...patch };
  if (!isParsedItem(probe)) return NextResponse.json({ error: "Invalid amount, date or category." }, { status: 400 });

  const updated = await updateExpense(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ expense: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await deleteExpense(id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
