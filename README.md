# Personal Expense Tracker

A Next.js app where you write what you spent in plain words —

> Spent 180 on breakfast, uber to office 240 and 1.2k on groceries. Yesterday paid electricity bill 1,840 and 2 coffees for 350.

— and it splits that into separate expenses, categorizes each one, works out the dates, and shows your **daily, weekly and monthly** totals with category breakdowns.

## How it stays precise

- **Exact arithmetic.** Amounts are stored as integer paise/cents, so totals never drift from floating-point rounding.
- **Two independent readers.** With an Anthropic API key, Claude reads the note (structured output, fixed category list). A deterministic rule parser reads the same note separately; any amount the two disagree on, or a total mismatch, is flagged.
- **Review before saving.** Every parsed item appears in an editable table (description, amount, category, date) along with the exact fragment it came from. Nothing is saved until you confirm.
- **Understands how people write:** `1.2k`, `2 lakh`, `1,00,000`, `₹450`, `Rs. 450`, `450/-`, `fifty`, `two hundred fifty`; quantities and times aren't mistaken for amounts (`2 coffees for 300`, `2 kg apples`, `at 5 pm`); income/refunds are skipped; dates like `yesterday`, `on monday`, `3 days ago`, `12th oct`, `12/10` — and a date carries over to the items after it.

## Running it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for AI parsing
npm run dev                  # http://localhost:3000
```

Without a key the app uses the rule parser only (offline, free). If an AI request fails, it falls back to the rule parser automatically and tells you.

Data is kept in your browser's localStorage. Use **Export JSON** / **Import JSON** at the bottom of the page to back it up or move it to another device.

## Periods

- **Daily** — any day, with ‹ › to step through days.
- **Weekly** — Monday to Sunday, with a per-day bar chart.
- **Monthly** — calendar month, per-day bars, average per day, and how many days you spent on.

Click a bar to jump to that day; click a summary tile to jump to that period.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Parser and money-rounding tests |
| `npm run lint` | ESLint |

## Code map

- `src/lib/ruleParser.ts` — deterministic text → expenses parser
- `src/lib/aiParser.ts` — Claude structured-output extraction
- `src/app/api/parse/route.ts` — runs both, cross-checks, falls back
- `src/lib/money.ts`, `src/lib/dates.ts`, `src/lib/summary.ts` — exact money math, calendar math, aggregation
- `src/lib/useExpenses.ts` — localStorage persistence
- `src/components/` — entry/review panel, charts, expense list
