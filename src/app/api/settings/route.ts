import { NextResponse } from "next/server";
import { setCurrency } from "@/lib/db";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const currency = body?.currency;
  if (typeof currency !== "string" || !(currency in CURRENCIES)) {
    return NextResponse.json({ error: "Unknown currency." }, { status: 400 });
  }
  await setCurrency(currency as CurrencyCode);
  return NextResponse.json({ currency });
}
