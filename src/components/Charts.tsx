"use client";

import { useState } from "react";
import type { Category } from "@/lib/categories";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { formatMoney, type CurrencyCode } from "@/lib/money";

interface DayBarsProps {
  days: { date: string; amountMinor: number }[];
  currency: CurrencyCode;
  today: string;
  /** "week" labels bars Mon..Sun; "month" labels them by day of month. */
  mode: "week" | "month";
  onSelectDay?: (date: string) => void;
}

/** Spend per day as vertical bars, one hue, with a hover readout. */
export function DayBars({ days, currency, today, mode, onSelectDay }: DayBarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.amountMinor), 1);
  const active = hover !== null ? days[hover] : null;

  return (
    <figure>
      <figcaption className="tabular h-5 text-sm text-ink-2">
        {active ? (
          <>
            {formatLongDate(active.date)} · <strong className="text-ink">{formatMoney(active.amountMinor, currency)}</strong>
          </>
        ) : (
          <span className="text-ink-3">Hover or tap a bar for the exact amount</span>
        )}
      </figcaption>
      <div
        className="mt-2 flex h-40 items-end gap-[2px] border-b border-border"
        role="img"
        aria-label="Spending per day"
        onMouseLeave={() => setHover(null)}
      >
        {days.map((d, i) => {
          const pct = (d.amountMinor / max) * 100;
          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => {
                setHover(i);
                onSelectDay?.(d.date);
              }}
              aria-label={`${formatLongDate(d.date)}: ${formatMoney(d.amountMinor, currency)}`}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-opacity ${
                  d.amountMinor > 0 ? "bg-bar" : "bg-transparent"
                } ${hover !== null && hover !== i ? "opacity-50" : ""} ${d.date > today ? "opacity-30" : ""}`}
                style={{ height: d.amountMinor > 0 ? `max(${pct}%, 3px)` : 0 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-ink-3">
        {days.map((d) => {
          const date = parseISODate(d.date);
          const label =
            mode === "week"
              ? date.toLocaleDateString("en-US", { weekday: "short" })
              : date.getDate() === 1 || date.getDate() % 5 === 0
                ? String(date.getDate())
                : "";
          return (
            <span key={d.date} className={`flex-1 text-center ${d.date === today ? "font-semibold text-ink" : ""}`}>
              {label}
            </span>
          );
        })}
      </div>
    </figure>
  );
}

interface CategoryBarsProps {
  rows: { category: Category; amountMinor: number; count: number }[];
  totalMinor: number;
  currency: CurrencyCode;
}

/** Category totals as sorted horizontal bars with exact values and share of total. */
export function CategoryBars({ rows, totalMinor, currency }: CategoryBarsProps) {
  const max = Math.max(...rows.map((r) => r.amountMinor), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-ink">
              {r.category} <span className="text-ink-3">· {r.count}</span>
            </span>
            <span className="tabular text-ink">
              {formatMoney(r.amountMinor, currency)}{" "}
              <span className="text-ink-3">{((r.amountMinor / totalMinor) * 100).toFixed(1)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-bar" style={{ width: `${(r.amountMinor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
