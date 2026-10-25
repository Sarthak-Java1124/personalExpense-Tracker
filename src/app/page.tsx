"use client";

import { useRef, useState } from "react";
import { CategoryBars, DayBars } from "@/components/Charts";
import { EntryPanel } from "@/components/EntryPanel";
import { ExpenseList } from "@/components/ExpenseList";
import {
  addDays,
  addMonths,
  daysInMonth,
  formatLongDate,
  formatMonth,
  formatShortDate,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "@/lib/dates";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { byCategory, byDay, inRange, total } from "@/lib/summary";
import { useExpenses } from "@/lib/useExpenses";

type Period = "day" | "week" | "month";

export default function Home() {
  const { expenses, currency, setCurrency, addMany, update, remove, importAll, loaded } = useExpenses();
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!loaded) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-ink-3">Loading…</main>;
  }

  const today = toISODate(new Date());
  const current = anchor ?? today;

  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);
  const todayTotal = total(inRange(expenses, today, today));
  const weekTotal = total(inRange(expenses, weekStart, addDays(weekStart, 6)));
  const monthTotal = total(inRange(expenses, monthStart, addDays(monthStart, daysInMonth(today) - 1)));
  const monthDaysElapsed = Number(today.slice(8, 10));

  let start: string;
  let end: string;
  let title: string;
  if (period === "day") {
    start = end = current;
    title = current === today ? `Today · ${formatLongDate(current)}` : formatLongDate(current);
  } else if (period === "week") {
    start = startOfWeek(current);
    end = addDays(start, 6);
    title = `${formatShortDate(start)} – ${formatShortDate(end)}`;
  } else {
    start = startOfMonth(current);
    end = addDays(start, daysInMonth(current) - 1);
    title = formatMonth(current);
  }
  const periodExpenses = inRange(expenses, start, end);
  const periodTotal = total(periodExpenses);
  const categories = byCategory(periodExpenses);
  const dayCount = period === "week" ? 7 : period === "month" ? daysInMonth(current) : 1;
  const days = byDay(periodExpenses, start, dayCount);
  const elapsed = days.filter((d) => d.date <= today).length;
  const activeDays = days.filter((d) => d.amountMinor > 0).length;

  function shift(direction: -1 | 1) {
    if (period === "day") setAnchor(addDays(current, direction));
    else if (period === "week") setAnchor(addDays(current, 7 * direction));
    else setAnchor(addMonths(current, direction));
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ currency, expenses }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const rows = Array.isArray(data) ? data : data.expenses;
      if (!Array.isArray(rows)) throw new Error();
      if (!confirm(`Replace your ${expenses.length} saved expenses with the ones in "${file.name}"?`)) return;
      const kept = importAll(rows);
      if (data.currency in CURRENCIES) setCurrency(data.currency);
      flash(`Imported ${kept} expenses.`);
    } catch {
      flash("That file isn't a valid export.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expense Tracker</h1>
          <p className="text-sm text-ink-2">Write what you spent. It sorts and adds it up.</p>
        </div>
        <select
          aria-label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
            <option key={code} value={code}>
              {symbol} {code}
            </option>
          ))}
        </select>
      </header>

      <EntryPanel
        currency={currency}
        onSave={(items) => {
          addMany(items);
          flash(`Saved ${items.length} ${items.length === 1 ? "expense" : "expenses"}.`);
        }}
      />

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Today" value={formatMoney(todayTotal, currency)} onClick={() => { setPeriod("day"); setAnchor(null); }} />
        <StatTile
          label="This week"
          value={formatMoney(weekTotal, currency)}
          sub={`Mon ${formatShortDate(weekStart)} onward`}
          onClick={() => { setPeriod("week"); setAnchor(null); }}
        />
        <StatTile
          label={`This month · ${formatMonth(today)}`}
          value={formatMoney(monthTotal, currency)}
          sub={`Avg ${formatMoney(Math.round(monthTotal / monthDaysElapsed), currency)}/day so far`}
          onClick={() => { setPeriod("month"); setAnchor(null); }}
        />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" className="flex rounded-lg bg-surface-2 p-1 text-sm">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 ${period === p ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2"}`}
              >
                {p === "day" ? "Daily" : p === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Previous" onClick={() => shift(-1)} className="rounded-md px-2 py-1 hover:bg-surface-2">
              ‹
            </button>
            <button
              type="button"
              onClick={() => setAnchor(null)}
              disabled={anchor === null || anchor === today}
              className="rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-surface-2 disabled:opacity-40"
            >
              Today
            </button>
            <button type="button" aria-label="Next" onClick={() => shift(1)} className="rounded-md px-2 py-1 hover:bg-surface-2">
              ›
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-ink-2">{title}</p>
            <p className="tabular text-3xl font-semibold tracking-tight">{formatMoney(periodTotal, currency)}</p>
          </div>
          <p className="tabular text-sm text-ink-3">
            {periodExpenses.length} {periodExpenses.length === 1 ? "expense" : "expenses"}
            {period !== "day" && elapsed > 0 && (
              <>
                {" · "}avg {formatMoney(Math.round(periodTotal / elapsed), currency)}/day · spent on {activeDays} of {elapsed} days
              </>
            )}
          </p>
        </div>

        {period !== "day" && (
          <div className="mt-5">
            <DayBars
              days={days}
              currency={currency}
              today={today}
              mode={period}
              onSelectDay={(d) => {
                setPeriod("day");
                setAnchor(d);
              }}
            />
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink-2">By category</h3>
            {categories.length ? (
              <CategoryBars rows={categories} totalMinor={periodTotal} currency={currency} />
            ) : (
              <p className="text-sm text-ink-3">—</p>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink-2">Expenses</h3>
            <ExpenseList expenses={periodExpenses} currency={currency} onUpdate={update} onRemove={remove} />
          </div>
        </div>
      </section>

      <footer className="mt-6 flex flex-wrap items-center gap-3 text-sm text-ink-3">
        <span>{expenses.length} expenses saved in this browser.</span>
        <button type="button" onClick={exportData} className="underline-offset-2 hover:text-ink hover:underline">
          Export JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="underline-offset-2 hover:text-ink hover:underline">
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = "";
          }}
        />
      </footer>

      {toast && (
        <div className="fixed inset-x-0 bottom-4 mx-auto w-fit rounded-lg bg-ink px-4 py-2 text-sm text-bg shadow-lg">{toast}</div>
      )}
    </main>
  );
}

function StatTile({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
    >
      <p className="text-sm text-ink-2">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </button>
  );
}
