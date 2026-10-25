import "server-only";
import { createClient, type Client, type InStatement } from "@libsql/client";
import type { Category } from "./categories";
import type { CurrencyCode } from "./money";
import type { Expense, ParsedItem } from "./types";

/**
 * Persistent storage. Locally this is a SQLite file (DATABASE_URL defaults to
 * file:expenses.db); in production point DATABASE_URL at a hosted libSQL/Turso
 * database and set DATABASE_AUTH_TOKEN.
 */
let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  client ??= createClient({
    url: process.env.DATABASE_URL || "file:expenses.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return client;
}

async function db(): Promise<Client> {
  const c = getClient();
  ready ??= c
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          source_text TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        )`,
        "CREATE INDEX IF NOT EXISTS expenses_date ON expenses (date)",
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      ],
      "write",
    )
    .then(() => undefined)
    .catch((err) => {
      ready = null;
      throw err;
    });
  await ready;
  return c;
}

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    date: String(row.date),
    description: String(row.description),
    category: String(row.category) as Category,
    amountMinor: Number(row.amount_minor),
    sourceText: String(row.source_text),
    createdAt: String(row.created_at),
  };
}

const INSERT_SQL = `INSERT INTO expenses (id, date, description, category, amount_minor, source_text, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

function insertStatement(e: Expense, sql = INSERT_SQL): InStatement {
  return { sql, args: [e.id, e.date, e.description, e.category, e.amountMinor, e.sourceText, e.createdAt] };
}

export async function listExpenses(): Promise<Expense[]> {
  const c = await db();
  const rs = await c.execute("SELECT * FROM expenses ORDER BY date, created_at");
  return rs.rows.map((r) => rowToExpense(r as Record<string, unknown>));
}

export async function addExpenses(items: ParsedItem[]): Promise<Expense[]> {
  const c = await db();
  const now = new Date().toISOString();
  const created = items.map((i) => ({ ...i, id: crypto.randomUUID(), createdAt: now }));
  await c.batch(created.map((e) => insertStatement(e)), "write");
  return created;
}

export async function updateExpense(id: string, patch: Partial<ParsedItem>): Promise<Expense | null> {
  const c = await db();
  const columns: Record<keyof ParsedItem, string> = {
    date: "date",
    description: "description",
    category: "category",
    amountMinor: "amount_minor",
    sourceText: "source_text",
  };
  const sets: string[] = [];
  const args: (string | number)[] = [];
  for (const [key, column] of Object.entries(columns) as [keyof ParsedItem, string][]) {
    if (patch[key] !== undefined) {
      sets.push(`${column} = ?`);
      args.push(patch[key] as string | number);
    }
  }
  if (sets.length) await c.execute({ sql: `UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`, args: [...args, id] });
  const rs = await c.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
  return rs.rows[0] ? rowToExpense(rs.rows[0] as Record<string, unknown>) : null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

/** Atomically replaces every expense (used by JSON import). */
export async function replaceAllExpenses(expenses: Expense[]): Promise<void> {
  const c = await db();
  await c.batch(["DELETE FROM expenses", ...expenses.map((e) => insertStatement(e))], "write");
}

/** Adds expenses keeping their ids; rows whose id already exists are skipped. Returns how many were added. */
export async function mergeExpenses(expenses: Expense[]): Promise<number> {
  const c = await db();
  const results = await c.batch(
    expenses.map((e) => insertStatement(e, INSERT_SQL.replace("INSERT INTO", "INSERT OR IGNORE INTO"))),
    "write",
  );
  return results.reduce((n, r) => n + r.rowsAffected, 0);
}

export async function getCurrency(): Promise<CurrencyCode | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT value FROM settings WHERE key = 'currency'", args: [] });
  return rs.rows[0] ? (String(rs.rows[0].value) as CurrencyCode) : null;
}

export async function setCurrency(currency: CurrencyCode): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO settings (key, value) VALUES ('currency', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [currency],
  });
}
