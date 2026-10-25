export const CURRENCIES = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Converts a decimal amount to integer minor units, rounding half away from zero at 2 dp. */
export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) return NaN;
  // Round via string to dodge binary float artifacts (e.g. 1.005 * 100 = 100.49999).
  return Math.round(Number(`${amount.toFixed(6)}e2`));
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Exact integer sum; never accumulates floats. */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function formatMoney(minor: number, currency: CurrencyCode): string {
  const { locale } = CURRENCIES[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}
