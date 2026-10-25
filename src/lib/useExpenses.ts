"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCIES, type CurrencyCode } from "./money";
import type { Expense, ParsedItem } from "./types";
import { isExpense } from "./validate";

/** Where older versions of the app kept data, before the database existed. */
const LEGACY_EXPENSES_KEY = "expense-tracker:expenses:v1";

function readLegacy(): Expense[] {
  try {
    const raw = localStorage.getItem(LEGACY_EXPENSES_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.filter(isExpense) : [];
  } catch {
    return [];
  }
}

function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_EXPENSES_KEY);
  } catch {
    // Storage blocked; nothing to clear.
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Not signed in.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrencyState] = useState<CurrencyCode>("INR");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [legacy, setLegacy] = useState<Expense[]>([]);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ expenses: Expense[]; currency: string | null; authEnabled: boolean }>("/api/expenses");
      setExpenses(data.expenses);
      if (data.currency && data.currency in CURRENCIES) setCurrencyState(data.currency as CurrencyCode);
      setAuthEnabled(data.authEnabled);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your expenses.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setLegacy(readLegacy());
    reload();
  }, [reload]);

  const setCurrency = useCallback(async (c: CurrencyCode) => {
    setCurrencyState(c);
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ currency: c }) });
  }, []);

  const addMany = useCallback(async (items: ParsedItem[]) => {
    const data = await api<{ expenses: Expense[] }>("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    setExpenses((prev) => [...prev, ...data.expenses]);
  }, []);

  const update = useCallback(async (id: string, patch: Partial<ParsedItem>) => {
    const data = await api<{ expense: Expense }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setExpenses((prev) => prev.map((e) => (e.id === id ? data.expense : e)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/api/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /** Replaces all stored expenses with an imported list; returns how many valid rows were kept. */
  const importAll = useCallback(async (rows: unknown[]): Promise<number> => {
    const data = await api<{ added: number; expenses: Expense[] }>("/api/expenses", {
      method: "PUT",
      body: JSON.stringify({ expenses: rows, mode: "replace" }),
    });
    setExpenses(data.expenses);
    return data.added;
  }, []);

  /** Moves expenses saved only in this browser into the database. */
  const migrateLegacy = useCallback(async (): Promise<number> => {
    const data = await api<{ added: number; expenses: Expense[] }>("/api/expenses", {
      method: "PUT",
      body: JSON.stringify({ expenses: legacy, mode: "merge" }),
    });
    setExpenses(data.expenses);
    clearLegacy();
    setLegacy([]);
    return data.added;
  }, [legacy]);

  const dismissLegacy = useCallback(() => {
    clearLegacy();
    setLegacy([]);
  }, []);

  return {
    expenses, currency, setCurrency, addMany, update, remove, importAll, reload,
    loaded, loadError, authEnabled, legacyCount: legacy.length, migrateLegacy, dismissLegacy,
  };
}
