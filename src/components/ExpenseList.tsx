"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatLongDate } from "@/lib/dates";
import { formatMoney, fromMinor, toMinor, type CurrencyCode } from "@/lib/money";
import { total } from "@/lib/summary";
import type { Expense } from "@/lib/types";

interface Props {
  expenses: Expense[];
  currency: CurrencyCode;
  onUpdate: (id: string, patch: Partial<Omit<Expense, "id">>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/** Expenses grouped by day (newest first), each editable in place. */
export function ExpenseList({ expenses, currency, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  const groups = new Map<string, Expense[]>();
  for (const e of [...expenses].sort((a, b) => b.date.localeCompare(a.date) || a.createdAt.localeCompare(b.createdAt))) {
    groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  }

  if (expenses.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">Nothing spent in this period.</p>;
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([date, list]) => (
        <div key={date}>
          <div className="flex justify-between border-b border-border pb-1 text-xs font-medium uppercase tracking-wide text-ink-3">
            <span>{formatLongDate(date)}</span>
            <span className="tabular">{formatMoney(total(list), currency)}</span>
          </div>
          <ul>
            {list.map((e) =>
              editing === e.id ? (
                <EditRow key={e.id} expense={e} onDone={() => setEditing(null)} onUpdate={onUpdate} />
              ) : (
                <li key={e.id} className="group flex items-center gap-3 border-b border-border/60 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{e.description}</p>
                    <p className="truncate text-xs text-ink-3">{e.category}</p>
                  </div>
                  <span className="tabular text-sm font-medium">{formatMoney(e.amountMinor, currency)}</span>
                  <button
                    type="button"
                    onClick={() => setEditing(e.id)}
                    className="rounded px-1.5 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${e.description}`}
                    onClick={() => {
                      if (confirm(`Delete "${e.description}" (${formatMoney(e.amountMinor, currency)})?`)) onRemove(e.id).catch(() => {});
                    }}
                    className="rounded px-1.5 text-xs text-ink-3 hover:bg-surface-2 hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EditRow({
  expense,
  onDone,
  onUpdate,
}: {
  expense: Expense;
  onDone: () => void;
  onUpdate: Props["onUpdate"];
}) {
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(fromMinor(expense.amountMinor)));
  const [category, setCategory] = useState<Category>(expense.category);
  const [date, setDate] = useState(expense.date);
  const amountMinor = toMinor(Number(amount));
  const [saving, setSaving] = useState(false);
  const valid = amountMinor > 0 && Boolean(date);

  return (
    <li className="grid grid-cols-2 gap-2 border-b border-border/60 py-2 sm:grid-cols-[1fr_7rem_10rem_9rem_auto]">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="col-span-2 rounded-md border border-border bg-bg px-2 py-1 text-sm sm:col-span-1"
      />
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        className={`tabular rounded-md border bg-bg px-2 py-1 text-right text-sm ${valid ? "border-border" : "border-danger"}`}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
      />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onUpdate(expense.id, { description: description.trim() || "Expense", amountMinor, category, date });
              onDone();
            } catch {
              setSaving(false); // Error already shown; stay in edit mode.
            }
          }}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-ink disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2">
          Cancel
        </button>
      </div>
    </li>
  );
}
