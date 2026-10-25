"use client";

import { useCallback, useEffect, useState } from "react";
import { isCategory } from "./categories";
import { isISODate } from "./dates";
import { CURRENCIES, type CurrencyCode } from "./money";
import type { Expense, ParsedItem } from "./types";

const EXPENSES_KEY = "expense-tracker:expenses:v1";
const CURRENCY_KEY = "expense-tracker:currency:v1";

function isExpense(value: unknown): value is Expense {
  const e = value as Expense;
  return (
    typeof e === "object" && e !== null &&
    typeof e.id === "string" &&
    typeof e.description === "string" &&
    typeof e.amountMinor === "number" && Number.isInteger(e.amountMinor) && e.amountMinor > 0 &&
    typeof e.date === "string" && isISODate(e.date) &&
    typeof e.category === "string" && isCategory(e.category)
  );
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the in-memory state still works for this session.
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrencyState] = useState<CurrencyCode>("INR");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readStorage<unknown[]>(EXPENSES_KEY);
    if (Array.isArray(stored)) setExpenses(stored.filter(isExpense));
    const cur = readStorage<string>(CURRENCY_KEY);
    if (cur && cur in CURRENCIES) setCurrencyState(cur as CurrencyCode);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeStorage(EXPENSES_KEY, expenses);
  }, [expenses, loaded]);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    writeStorage(CURRENCY_KEY, c);
  }, []);

  const addMany = useCallback((items: ParsedItem[]) => {
    const now = new Date().toISOString();
    setExpenses((prev) => [...prev, ...items.map((i) => ({ ...i, id: newId(), createdAt: now }))]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Expense, "id">>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const remove = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /** Replaces all data with an imported list; returns how many valid rows were kept. */
  const importAll = useCallback((rows: unknown[]): number => {
    const valid = rows.filter(isExpense);
    setExpenses(valid);
    return valid.length;
  }, []);

  return { expenses, currency, setCurrency, addMany, update, remove, importAll, loaded };
}
