import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AIUnavailableError, parseWithAI } from "@/lib/aiParser";
import { isISODate } from "@/lib/dates";
import { formatMoney, sumMinor, type CurrencyCode, CURRENCIES } from "@/lib/money";
import { parseWithRules } from "@/lib/ruleParser";
import type { ParsedItem, ParseResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 5000;

/**
 * Compares the AI's amounts with the independent rule-based reading of the same
 * note, so a misread number is flagged instead of silently saved.
 */
function crossCheck(ai: ParsedItem[], rules: ParsedItem[], currency: CurrencyCode): string[] {
  const warnings: string[] = [];
  const remaining = rules.map((r) => r.amountMinor);
  for (const item of ai) {
    const idx = remaining.indexOf(item.amountMinor);
    if (idx >= 0) remaining.splice(idx, 1);
    else {
      warnings.push(
        `Double-check "${item.description}" (${formatMoney(item.amountMinor, currency)}): the independent rule check didn't find this amount — please verify.`,
      );
    }
  }
  const aiTotal = sumMinor(ai.map((i) => i.amountMinor));
  const rulesTotal = sumMinor(rules.map((i) => i.amountMinor));
  if (aiTotal !== rulesTotal && rules.length > 0) {
    warnings.push(
      `Totals differ between readings: AI ${formatMoney(aiTotal, currency)} vs. rule check ${formatMoney(rulesTotal, currency)}. Review the items below before saving.`,
    );
  }
  return warnings;
}

export async function POST(request: Request) {
  let body: { text?: unknown; referenceDate?: unknown; currency?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const referenceDate = typeof body.referenceDate === "string" ? body.referenceDate : "";
  const currency = (typeof body.currency === "string" && body.currency in CURRENCIES ? body.currency : "INR") as CurrencyCode;

  if (!text) return NextResponse.json({ error: "Write what you spent first." }, { status: 400 });
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: `Keep it under ${MAX_INPUT_CHARS} characters per entry.` }, { status: 400 });
  }
  if (!isISODate(referenceDate)) {
    return NextResponse.json({ error: "referenceDate must be YYYY-MM-DD." }, { status: 400 });
  }

  const rules = parseWithRules(text, referenceDate);
  const hasAI = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  if (hasAI) {
    try {
      const ai = await parseWithAI(text, referenceDate, currency);
      const result: ParseResponse = {
        items: ai.items,
        engine: "ai",
        warnings: [...ai.warnings, ...crossCheck(ai.items, rules.items, currency)],
      };
      return NextResponse.json(result);
    } catch (err) {
      let reason = "AI parsing failed";
      if (err instanceof AIUnavailableError) reason = err.message;
      else if (err instanceof Anthropic.AuthenticationError) reason = "The Anthropic API key was rejected";
      else if (err instanceof Anthropic.RateLimitError) reason = "The AI is rate-limited right now";
      else if (err instanceof Anthropic.APIError) reason = `AI request failed (${err.status ?? "network"})`;
      console.error("AI parse failed, falling back to rules:", err);
      const result: ParseResponse = {
        items: rules.items,
        engine: "rules",
        warnings: [`${reason} — used the built-in rule parser instead.`, ...rules.warnings],
      };
      return NextResponse.json(result);
    }
  }

  const result: ParseResponse = { items: rules.items, engine: "rules", warnings: rules.warnings };
  return NextResponse.json(result);
}
