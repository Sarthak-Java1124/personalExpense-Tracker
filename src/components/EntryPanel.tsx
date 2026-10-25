"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { toISODate } from "@/lib/dates";
import { formatMoney, fromMinor, sumMinor, toMinor, type CurrencyCode } from "@/lib/money";
import type { ParsedItem, ParseResponse } from "@/lib/types";

const EXAMPLE =
  "Spent 180 on breakfast, uber to office 240 and 1.2k on groceries at DMart. Yesterday paid electricity bill 1,840 and 2 coffees for 350.";

interface Props {
  currency: CurrencyCode;
  onSave: (items: ParsedItem[]) => void;
}

interface DraftItem extends ParsedItem {
  key: number;
  amountText: string;
}

export function EntryPanel({ currency, onSave }: Props) {
  const [text, setText] = useState("");
  const [referenceDate, setReferenceDate] = useState(() => toISODate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [engine, setEngine] = useState<ParseResponse["engine"] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleParse() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, referenceDate, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");
      const parsed = data as ParseResponse;
      setDrafts(
        parsed.items.map((item, i) => ({ ...item, key: i, amountText: String(fromMinor(item.amountMinor)) })),
      );
      setEngine(parsed.engine);
      setWarnings(parsed.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function patch(key: number, change: Partial<DraftItem>) {
    setDrafts((prev) => prev?.map((d) => (d.key === key ? { ...d, ...change } : d)) ?? null);
  }

  function addRow() {
    setDrafts((prev) => [
      ...(prev ?? []),
      {
        key: Date.now(),
        description: "",
        category: "Other",
        amountMinor: 0,
        amountText: "",
        date: referenceDate,
        sourceText: "(added manually)",
      },
    ]);
  }

  const validDrafts = (drafts ?? []).map((d) => ({ ...d, amountMinor: toMinor(Number(d.amountText)) }));
  const invalid = validDrafts.some((d) => !(d.amountMinor > 0) || !d.date);
  const draftTotal = sumMinor(validDrafts.filter((d) => d.amountMinor > 0).map((d) => d.amountMinor));

  function handleSave() {
    if (!drafts || invalid || validDrafts.length === 0) return;
    onSave(
      validDrafts.map(({ description, category, amountMinor, date, sourceText }) => ({
        description: description.trim() || "Expense",
        category,
        amountMinor,
        date,
        sourceText,
      })),
    );
    setDrafts(null);
    setWarnings([]);
    setEngine(null);
    setText("");
  }

  function handleDiscard() {
    setDrafts(null);
    setWarnings([]);
    setEngine(null);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <label htmlFor="entry" className="text-sm font-medium text-ink-2">
        What did you spend?
      </label>
      <textarea
        id="entry"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse();
        }}
        rows={3}
        placeholder={EXAMPLE}
        className="mt-2 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-base text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-accent"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Relative to
          <input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-ink"
          />
        </label>
        <div className="ml-auto flex gap-2">
          {!text && (
            <button
              type="button"
              onClick={() => setText(EXAMPLE)}
              className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2"
            >
              Try example
            </button>
          )}
          <button
            type="button"
            onClick={handleParse}
            disabled={!text.trim() || loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {loading ? "Reading…" : "Read expenses"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Words like “yesterday”, “on monday” or “12th oct” are counted from this date. Ctrl/⌘+Enter to submit.
      </p>

      {error && <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">{error}</p>}

      {drafts && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Check before saving</h2>
            <span className="text-xs text-ink-3">
              {engine === "ai" ? "Read by Claude, cross-checked by rules" : "Read by the built-in rule parser"}
            </span>
          </div>

          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">
              {warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">No expenses found in that text. Add one manually below.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {drafts.map((d) => {
                const bad = !(toMinor(Number(d.amountText)) > 0);
                return (
                  <li key={d.key} className="rounded-lg border border-border bg-bg p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_11rem_9rem_auto]">
                      <input
                        aria-label="Description"
                        value={d.description}
                        onChange={(e) => patch(d.key, { description: e.target.value })}
                        className="col-span-2 rounded-md border border-border bg-surface px-2 py-1.5 sm:col-span-1"
                      />
                      <input
                        aria-label="Amount"
                        inputMode="decimal"
                        value={d.amountText}
                        onChange={(e) => patch(d.key, { amountText: e.target.value.replace(/[^\d.]/g, "") })}
                        className={`tabular rounded-md border bg-surface px-2 py-1.5 text-right ${bad ? "border-danger" : "border-border"}`}
                      />
                      <select
                        aria-label="Category"
                        value={d.category}
                        onChange={(e) => patch(d.key, { category: e.target.value as Category })}
                        className="rounded-md border border-border bg-surface px-2 py-1.5"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        aria-label="Date"
                        type="date"
                        value={d.date}
                        onChange={(e) => patch(d.key, { date: e.target.value })}
                        className="rounded-md border border-border bg-surface px-2 py-1.5"
                      />
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setDrafts((prev) => prev?.filter((x) => x.key !== d.key) ?? null)}
                        className="rounded-md px-2 text-ink-3 hover:bg-surface-2 hover:text-danger"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-ink-3">from: “{d.sourceText}”</p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={addRow} className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              + Add row
            </button>
            <span className="tabular ml-auto text-sm text-ink-2">
              Total <strong className="text-ink">{formatMoney(draftTotal, currency)}</strong>
            </span>
            <button type="button" onClick={handleDiscard} className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={invalid || validDrafts.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              Save {validDrafts.length || ""} {validDrafts.length === 1 ? "expense" : "expenses"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
