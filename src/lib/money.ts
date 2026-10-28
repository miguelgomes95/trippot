// Money helpers. Everything is integer cents; PayPal wants "123.45" strings.

export const toPayPalValue = (cents: number) => (cents / 100).toFixed(2);

export const fromPayPalValue = (value: string) => Math.round(Number(value) * 100);

export function formatMoney(cents: number, currency = "EUR", locale = "en-GB") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/**
 * Split `totalCents` across `weights` so the parts always add up to the total.
 * Leftover cents go to the largest remainders (largest remainder method).
 */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("splitByWeights: weights must sum to > 0");
  const raw = weights.map((w) => (totalCents * w) / sum);
  const parts = raw.map(Math.floor);
  let left = totalCents - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left-- <= 0) break;
    parts[i] += 1;
  }
  return parts;
}
