import { categorize } from "./categories";
import { addDays, isISODate, parseISODate, toISODate } from "./dates";
import { toMinor } from "./money";
import type { ParsedItem } from "./types";

/**
 * Deterministic, offline expense parser. It is used on its own when no AI key is
 * configured, and as an independent cross-check of the AI's numbers otherwise.
 */
export interface RuleParseResult {
  items: ParsedItem[];
  warnings: string[];
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const INCOME_PATTERN =
  /\b(received|receive|earned|salary|got paid|refund(ed)?|cashback|reimburs\w*|credited|income|won)\b/i;

const LEADING_FILLER = new Set([
  "i", "we", "me", "my", "also", "and", "then", "plus", "spent", "spend", "spending", "paid", "pay", "paying",
  "bought", "buy", "purchased", "had", "got", "gave", "on", "for", "at", "to", "in", "the", "a", "an", "of",
  "around", "about", "approx", "approximately", "roughly", "almost", "nearly", "just", "only", "another",
  "worth", "cost", "costs", "costing", "was", "were", "is", "it", "rs", "rs.", "inr", "rupees", "rupee",
  "bucks", "dollars", "total", "totally", "some", "like", "-", "–", ":", "=", "+", "&", "with", "by", "via",
]);

const TRAILING_FILLER = new Set([
  "on", "for", "at", "to", "in", "the", "a", "an", "of", "and", "spent", "paid", "rs", "rs.", "inr",
  "rupees", "rupee", "bucks", "dollars", "only", "-", "–", ":", "=", "+", "&", "was", "were", "is", "it", "with", "by",
]);

const QUANTITY_UNITS =
  /^\s*(kg|kgs|kilo|kilos|g|gm|gms|grams?|km|kms|litres?|liters?|ltrs?|ml|pcs|pieces?|x|pm|am|hrs?|hours?|mins?|minutes?|days?|nights?|people|persons?|plates?|cups?|packets?|dozen|items?|times?|%)\b/i;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const SCALE_WORDS: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, million: 1000000 };

/** Replaces runs of number words ("two hundred fifty") with digits. */
function replaceNumberWords(text: string): string {
  const unit = `(?:${Object.keys(NUMBER_WORDS).join("|")})`;
  const word = `(?:${[...Object.keys(NUMBER_WORDS), ...Object.keys(SCALE_WORDS)].join("|")})`;
  // A run must start with a unit word, so "1.5 lakh" keeps its digits and isn't read as "1.5 100000".
  const run = new RegExp(`\\b${unit}(?:[\\s-]+(?:and\\s+)?${word})*\\b`, "gi");
  return text.replace(run, (match) => {
    const tokens = match.toLowerCase().split(/[\s-]+/).filter((t) => t !== "and");
    let total = 0;
    let current = 0;
    for (const t of tokens) {
      if (t in NUMBER_WORDS) current += NUMBER_WORDS[t];
      else if (t === "hundred") current = (current || 1) * 100;
      else {
        total += (current || 1) * SCALE_WORDS[t];
        current = 0;
      }
    }
    return String(total + current);
  });
}

/** Removes digit-grouping commas: 1,200 -> 1200 and Indian 1,00,000 -> 100000. */
function stripGroupingCommas(text: string): string {
  let prev: string;
  let out = text;
  do {
    prev = out;
    out = out.replace(/(\d),(\d{2,3})(?!\d)/g, "$1$2");
  } while (out !== prev);
  return out;
}

interface DateHit {
  date: string;
  start: number;
  end: number;
}

/** Finds the first date expression in a clause, resolved against the reference date. */
function findDate(clause: string, referenceDate: string): DateHit | null {
  const ref = parseISODate(referenceDate);
  const lower = clause.toLowerCase();
  const tryPattern = (re: RegExp, resolve: (m: RegExpExecArray) => string | null): DateHit | null => {
    const m = re.exec(lower);
    if (!m) return null;
    const date = resolve(m);
    return date ? { date, start: m.index, end: m.index + m[0].length } : null;
  };

  return (
    tryPattern(/\b(on\s+)?(the\s+)?day before yesterday\b/, () => addDays(referenceDate, -2)) ??
    tryPattern(/\b(on\s+)?yesterday('s)?\b|\blast night\b/, () => addDays(referenceDate, -1)) ??
    tryPattern(/\b(on\s+)?today('s)?\b|\btonight\b|\bthis (morning|afternoon|evening)\b/, () => referenceDate) ??
    tryPattern(/\b(\d{1,2})\s+days?\s+ago\b/, (m) => addDays(referenceDate, -Number(m[1]))) ??
    tryPattern(new RegExp(`\\b(on\\s+)?(last\\s+)?(${WEEKDAYS.join("|")})\\b`), (m) => {
      const target = WEEKDAYS.indexOf(m[3]);
      let back = (ref.getDay() - target + 7) % 7;
      if (m[2] && back === 0) back = 7;
      return addDays(referenceDate, -back);
    }) ??
    // 12/10, 12-10-2026, 12/10/26 (day first)
    tryPattern(/\b(on\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/, (m) => {
      let year = m[4] ? Number(m[4]) : ref.getFullYear();
      if (year < 100) year += 2000;
      const iso = `${year}-${String(m[3]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
      return isISODate(iso) ? iso : null;
    }) ??
    // 12th oct, 12 october, oct 12
    tryPattern(
      new RegExp(`\\b(on\\s+)?(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join("|")})[a-z]*|(${MONTHS.join("|")})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?)\\b`),
      (m) => {
        const day = Number(m[2] ?? m[5]);
        const month = MONTHS.indexOf((m[3] ?? m[4]).slice(0, 3)) + 1;
        let year = ref.getFullYear();
        let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // A date later than the reference date without a year most likely means last year.
        if (iso > referenceDate) {
          year -= 1;
          iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
        return isISODate(iso) ? iso : null;
      },
    ) ??
    // "on the 12th"
    tryPattern(/\bon\s+(the\s+)?(\d{1,2})(st|nd|rd|th)\b/, (m) => {
      const d = new Date(ref.getFullYear(), ref.getMonth(), Number(m[2]));
      if (toISODate(d) > referenceDate) d.setMonth(d.getMonth() - 1);
      const iso = toISODate(d);
      return isISODate(iso) && d.getDate() === Number(m[2]) ? iso : null;
    })
  );
}

interface AmountHit {
  value: number;
  start: number;
  end: number;
  /** True when a currency marker or "spent/paid/for" cue makes it clearly money. */
  strong: boolean;
}

const AMOUNT_RE =
  /(rs\.?|inr|₹|\$|usd|€|eur|£|gbp)?\s*(\d+(?:\.\d+)?)\s*(k\b|thousand\b|lakhs?\b|lacs?\b|million\b)?\s*(\/-|rs\b\.?|rupees?\b|bucks\b|inr\b|dollars?\b|euros?\b|pounds?\b)?/gi;

function findAmounts(clause: string): AmountHit[] {
  const hits: AmountHit[] = [];
  for (const m of clause.matchAll(AMOUNT_RE)) {
    const [full, prefix, num, scale, suffix] = m;
    const start = (m.index ?? 0) + full.indexOf(full.trimStart());
    const end = (m.index ?? 0) + full.trimEnd().length;
    const after = clause.slice((m.index ?? 0) + full.length);
    const before = clause.slice(0, start);
    // Skip quantities and times: "2 kg", "5 pm", "3 people", "10:30".
    if (!scale && !suffix && QUANTITY_UNITS.test(after)) continue;
    if (/:\s*$/.test(before) && /^\d/.test(after) ) continue;
    if (/^:\d/.test(after)) continue;
    let value = Number(num);
    const s = scale?.toLowerCase();
    if (s === "k" || s === "thousand") value *= 1000;
    else if (s?.startsWith("lakh") || s?.startsWith("lac")) value *= 100000;
    else if (s === "million") value *= 1000000;
    const cue = /\b(spent|spend|paid|pay|for|cost|costs|worth|of|bill|total)\s*$/i.test(before) || /[=:]\s*$/.test(before);
    hits.push({ value, start, end, strong: Boolean(prefix || suffix || scale || cue) });
  }
  return hits;
}

function cleanDescription(text: string): string {
  const words = text
    .replace(/[(),.;!?]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length && LEADING_FILLER.has(words[0].toLowerCase())) words.shift();
  while (words.length && TRAILING_FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
  const desc = words.join(" ").trim();
  if (!desc) return "Expense";
  return desc.charAt(0).toUpperCase() + desc.slice(1);
}

/** Splits text into clauses on punctuation and joining words, keeping decimals intact. */
function splitClauses(text: string): string[] {
  return text
    .split(/\n|;|,|(?<!\d)\.(?!\d)|\.(?=\s|$)|\s+(?:and|&|then|plus|also|after that|aur)\s+|\s\+\s/i)
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c));
}

export function parseWithRules(input: string, referenceDate: string): RuleParseResult {
  const warnings: string[] = [];
  const items: ParsedItem[] = [];
  const normalized = stripGroupingCommas(replaceNumberWords(input)).replace(/\b(rs|inr)\.\s*/gi, "$1 ");
  const clauses = splitClauses(normalized);

  // Clauses without any amount ("bread and butter 50" -> "bread" | "butter 50") are glued to a neighbour.
  const merged: string[] = [];
  let pending = "";
  for (const clause of clauses) {
    const withoutDate = (() => {
      const hit = findDate(clause, referenceDate);
      return hit ? clause.slice(0, hit.start) + clause.slice(hit.end) : clause;
    })();
    if (findAmounts(withoutDate).length === 0) {
      // A bare date phrase ("yesterday") stays on its own so it can set the date context.
      if (findDate(clause, referenceDate) && cleanDescription(withoutDate) === "Expense") {
        if (pending) merged.push(pending);
        merged.push(clause);
        pending = "";
      } else {
        pending = pending ? `${pending} and ${clause}` : clause;
      }
      continue;
    }
    merged.push(pending ? `${pending} and ${clause}` : clause);
    pending = "";
  }
  if (pending) {
    if (merged.length && findAmounts(merged[merged.length - 1]).length) {
      merged[merged.length - 1] += ` and ${pending}`;
    } else if (cleanDescription(pending) !== "Expense") {
      warnings.push(`No amount found in "${pending}" — skipped.`);
    }
  }

  // A date mentioned in one clause carries forward to later clauses until another date appears.
  let currentDate = referenceDate;
  for (const clause of merged) {
    const dateHit = findDate(clause, referenceDate);
    if (dateHit) currentDate = dateHit.date;
    const body = (dateHit ? clause.slice(0, dateHit.start) + " " + clause.slice(dateHit.end) : clause)
      // Times of day are never amounts: "at 5 pm", "10:30".
      .replace(/\b(at\s+|around\s+)?\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, " ")
      .replace(/\b(at\s+)?\d{1,2}:\d{2}\b/g, " ");

    if (INCOME_PATTERN.test(body)) {
      warnings.push(`"${clause}" looks like income, not spending — skipped.`);
      continue;
    }

    let amounts = findAmounts(body);
    if (amounts.length === 0) continue;
    const strong = amounts.filter((a) => a.strong);
    if (amounts.length > 1 && strong.length === 1) {
      // "2 coffees for 300": the cued number is the price, the other is a quantity.
      amounts = strong;
    } else if (amounts.length > 1 && strong.length === 0) {
      // "2 coffees 300": a small leading whole number followed by a word is a quantity.
      const first = amounts[0];
      const isQuantity =
        Number.isInteger(first.value) &&
        first.value <= 20 &&
        cleanDescription(body.slice(0, first.start)) === "Expense" &&
        /^\s+[a-z]/i.test(body.slice(first.end)) &&
        !/^\s+(on|for|at|in|to)\b/i.test(body.slice(first.end));
      if (isQuantity) amounts = amounts.slice(1);
      if (amounts.length > 1 || isQuantity) {
        warnings.push(`"${clause}" has several numbers — check that the split is right.`);
      }
    } else if (strong.length > 1) {
      amounts = strong;
    }

    // Does the description come after the amount ("200 on lunch") or before it ("lunch 200")?
    const amountFirst = cleanDescription(body.slice(0, amounts[0].start)) === "Expense";
    amounts.forEach((amount, i) => {
      const segment = amountFirst
        ? body.slice(amount.end, amounts[i + 1]?.start ?? body.length)
        : body.slice(amounts[i - 1]?.end ?? 0, amount.start) + " " + (i === amounts.length - 1 ? body.slice(amount.end) : "");
      const description = cleanDescription(segment);
      const amountMinor = toMinor(amount.value);
      if (!(amountMinor > 0)) return;
      items.push({
        description,
        category: categorize(`${description} ${body}`),
        amountMinor,
        date: currentDate,
        sourceText: clause.trim(),
      });
    });
  }

  return { items, warnings };
}
