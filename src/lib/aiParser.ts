import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES } from "./categories";
import { isISODate, weekdayName } from "./dates";
import { toMinor } from "./money";
import type { ParsedItem } from "./types";

const ExtractionSchema = z.object({
  expenses: z.array(
    z.object({
      description: z.string(),
      category: z.enum(CATEGORIES),
      amount: z.number(),
      date: z.string(),
      source_text: z.string(),
    }),
  ),
  ignored: z.array(z.object({ text: z.string(), reason: z.string() })),
});

const SYSTEM_PROMPT = `You extract personal expenses from a short note someone wrote about their spending. Your output feeds an expense tracker that sums the amounts exactly, so every number must be right.

Rules:
- Create one expense per distinct purchase or payment. "200 on lunch and 50 on tea" is two expenses.
- amount is the money spent, in the user's currency, as a plain number. Expand shorthand: "1.2k" = 1200, "2 lakh" = 200000, "fifty" = 50, "1,00,000" = 100000. Never convert currencies.
- Quantities are not amounts: in "2 coffees for 300" the amount is 300 (not 600, not 2). If a unit price is given with a quantity ("3 coffees at 100 each"), the amount is the total (300).
- If a total and its breakdown are both stated ("spent 500 on food: 300 lunch, 200 dinner"), record the breakdown items only, never both, so nothing is double counted.
- Do not record income, refunds, cashback, money received, or money someone else paid. Put those in ignored with a reason. Also put anything you cannot attach an amount to in ignored.
- date: resolve relative dates ("yesterday", "on monday", "3 days ago", "12th oct") against the reference date given in the message and return YYYY-MM-DD. A date mentioned for one item carries over to the following items until another date is mentioned. With no date mentioned, use the reference date. Never return a date after the reference date unless the note says so explicitly.
- description: a short, clean label in the user's words (e.g. "Lunch with friends", "Uber to office"), without the amount or date.
- category: choose the single best fit from the allowed list. Use "Other" only when nothing fits.
- source_text: the exact fragment of the note this expense came from.`;

export interface AIParseResult {
  items: ParsedItem[];
  warnings: string[];
}

export class AIUnavailableError extends Error {}

export async function parseWithAI(text: string, referenceDate: string, currency: string): Promise<AIParseResult> {
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    // On a safety decline the API re-runs the request on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(ExtractionSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Reference date: ${referenceDate} (${weekdayName(referenceDate)})\nCurrency: ${currency}\n\n<note>\n${text}\n</note>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new AIUnavailableError("The AI declined to process this note.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIUnavailableError("The note was too long for one request.");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new AIUnavailableError("The AI returned an unreadable response.");

  const warnings: string[] = [];
  const items: ParsedItem[] = [];
  for (const e of parsed.expenses) {
    const amountMinor = toMinor(e.amount);
    if (!(amountMinor > 0)) {
      warnings.push(`Skipped "${e.source_text}": amount ${e.amount} is not a positive number.`);
      continue;
    }
    let date = e.date;
    if (!isISODate(date)) {
      warnings.push(`"${e.source_text}": couldn't read date "${e.date}", used ${referenceDate}.`);
      date = referenceDate;
    }
    items.push({
      description: e.description.trim() || "Expense",
      category: e.category,
      amountMinor,
      date,
      sourceText: e.source_text,
    });
  }
  for (const ig of parsed.ignored) {
    warnings.push(`Ignored "${ig.text}": ${ig.reason}`);
  }
  return { items, warnings };
}
