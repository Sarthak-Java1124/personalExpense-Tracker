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

## Storage

Expenses are stored in a database (SQLite via [libSQL](https://github.com/tursodatabase/libsql)), so they survive browser resets and show up on every device that opens the app.

- **Locally** nothing to set up: data goes into `expenses.db` in the project folder (git-ignored). Back that file up, or use **Export JSON**.
- **Hosted (e.g. Vercel)** serverless hosts have no lasting disk, so use a hosted libSQL database. Create a free one at [turso.tech](https://turso.tech) (`turso db create expenses`, then `turso db show --url expenses` and `turso db tokens create expenses`) and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.
- **Self-hosted on a VPS** the default SQLite file works; just keep it on a persistent disk.

The tables are created automatically on first run. If you used an earlier version that saved to the browser, the app offers a one-click **Move to database**.

### Password

Set `APP_PASSWORD` to require a login (do this before putting the app on the internet: otherwise anyone with the URL can read your expenses and use your API key). Sessions last 30 days; changing the password signs everyone out.

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
- `src/lib/db.ts` — database schema and queries
- `src/app/api/expenses/` — save, edit, delete, import
- `src/lib/auth.ts`, `src/middleware.ts` — optional password login
- `src/lib/useExpenses.ts` — client data hook
- `src/components/` — entry/review panel, charts, expense list
