// Creates the demo trip and runs the whole planning flow:
// confirmations → AI extraction → AI split → instalments → (optional) PayPal invoices.
// Run: pnpm seed:demo            (plan only, no PayPal calls)
//      pnpm seed:demo --send     (also creates and sends sandbox invoices)
import { asc, eq, inArray } from "drizzle-orm";
import { db, tables } from "../src/db";
import { DEMO_CONFIRMATIONS, DEMO_TRAVELLERS, DEMO_TRIP } from "../src/lib/demo-data";
import { formatMoney } from "../src/lib/money";
import { importConfirmations } from "../src/lib/plan/save-bookings";
import { planSplit } from "../src/lib/plan/split";
import { buildInstalments, sendInvoices } from "../src/lib/plan/instalments";
import { parseTravellers } from "../src/lib/validate";

const { trips, travellers, shares, bookings, instalments } = tables;
const send = process.argv.includes("--send");

// Re-running replaces the previous demo trip (cascades to everything under it).
await db.delete(trips).where(eq(trips.name, DEMO_TRIP.name));

const { autopayLimit, ...details } = DEMO_TRIP;
const [trip] = await db
  .insert(trips)
  .values({ ...details, autopayLimitCents: Number(autopayLimit) * 100 })
  .returning();
await db.insert(travellers).values(parseTravellers(DEMO_TRAVELLERS).travellers.map((t) => ({ ...t, tripId: trip.id })));
console.log(`Trip ${trip.id}`);

const t0 = Date.now();
const { saved, warnings: w1 } = await importConfirmations(trip.id, DEMO_CONFIRMATIONS);
console.log(`\n1) Extracted ${saved.length} bookings (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
for (const { booking } of saved) console.log(`   ${booking.supplierName}: ${formatMoney(booking.totalCents)}`);

const t1 = Date.now();
const { warnings: w2 } = await planSplit(trip.id);
console.log(`\n2) Split planned (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
const people = await db.select().from(travellers).where(eq(travellers.tripId, trip.id)).orderBy(asc(travellers.name));
const bookingRows = await db.select().from(bookings).where(eq(bookings.tripId, trip.id));
const shareRows = await db.select().from(shares).where(inArray(shares.bookingId, bookingRows.map((b) => b.id)));
for (const p of people) {
  const mine = shareRows.filter((s) => s.travellerId === p.id);
  const parts = mine.map((s) => {
    const b = bookingRows.find((x) => x.id === s.bookingId)!;
    return `${b.supplierName.split(" ")[0]} ${formatMoney(s.amountCents)}${s.reason ? ` (${s.reason})` : ""}`;
  });
  console.log(`   ${p.name.padEnd(14)} ${formatMoney(mine.reduce((a, s) => a + s.amountCents, 0)).padStart(10)}  ${parts.join(" · ")}`);
}
for (const b of bookingRows) {
  const sum = shareRows.filter((s) => s.bookingId === b.id).reduce((a, s) => a + s.amountCents, 0);
  if (sum !== b.totalCents) throw new Error(`${b.supplierName}: shares ${sum} ≠ total ${b.totalCents}`);
}

const rows = await buildInstalments(trip.id, "2026-10-28");
console.log(`\n3) ${rows.length} instalments, e.g. ${people[0].name}:`);
for (const r of rows.filter((r) => r.travellerId === people[0].id))
  console.log(`   ${r.dueDate}  ${formatMoney(r.amountCents).padStart(9)}  ${r.label}`);

const warnings = [...w1, ...w2];
if (warnings.length) console.log(`\nWarnings:\n${warnings.map((w) => `   - ${w}`).join("\n")}`);

if (send) {
  const t2 = Date.now();
  const res = await sendInvoices(trip.id);
  console.log(`\n4) PayPal invoices: ${res.filter((r) => r.ok).length}/${res.length} sent (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
  for (const f of res.filter((r) => !r.ok)) console.log(`   ✗ ${f.error}`);
  const [one] = await db.select().from(instalments).where(eq(instalments.travellerId, people[0].id));
  console.log(`   payer link: ${one.paypalPayerUrl}`);
}
process.exit(0);
