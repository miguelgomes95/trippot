// Creates the demo trip and runs the whole planning flow:
// confirmations → AI extraction → AI split → instalments → (optional) PayPal invoices.
// Run: pnpm seed:demo            (plan only, no PayPal calls)
//      pnpm seed:demo --send     (also creates and sends sandbox invoices)
import { asc, eq, inArray } from "drizzle-orm";
import { db, tables } from "../src/db";
import { formatMoney } from "../src/lib/money";
import { importConfirmations } from "../src/lib/plan/save-bookings";
import { planSplit } from "../src/lib/plan/split";
import { buildInstalments, sendInvoices } from "../src/lib/plan/instalments";

const { trips, travellers, shares, bookings, instalments } = tables;
const send = process.argv.includes("--send");

const CONFIRMATIONS = `
From: reservations@riad-dar-zitoun.example
Subject: Booking confirmed — Riad Dar Zitoun, 14–18 May 2027

Dear Miguel,
Thank you for booking the whole riad (6 rooms, 12 guests) for 4 nights, 14 May to 18 May 2027.
Total: 2,880.00 EUR (breakfast included). Room 6 is a single: +90 EUR supplement included in the total.
Payment schedule: 30% deposit due by 1 March 2027, remaining balance due 15 April 2027.
Payments via PayPal to payments@riad-dar-zitoun.example.
Cancellation: free until 1 March; after that the deposit is non-refundable.

---
Atlas Desert Tours — booking #ADT-5521
Merzouga 2-day desert tour, 16–17 May 2027, 9 participants x 145 EUR = 1,305 EUR.
Full payment due 1 May 2027. Pay by PayPal: bookings@atlas-desert.example

---
Marrakech Transfers — airport pick-up and drop-off for 12 people, minibus, 14 and 18 May 2027.
Price: 240 EUR, payable in full by 30 April 2027 via PayPal to hello@mk-transfers.example
`;

const PEOPLE: [string, string | null][] = [
  ["Miguel Gomes", null],
  ["Ana Ribeiro", "Skips the desert tour"],
  ["Rui Costa", "Wants the single room"],
  ["Joana Pires", null],
  ["Tiago Matos", "Skips the desert tour"],
  ["Inês Lopes", null],
  ["Pedro Alves", null],
  ["Sofia Nunes", "Skips the desert tour"],
  ["Diogo Faria", null],
  ["Marta Silva", null],
  ["Hugo Santos", null],
  ["Rita Moreira", null],
];

// Re-running replaces the previous demo trip (cascades to everything under it).
await db.delete(trips).where(eq(trips.name, "Marrakech May 2027"));

const [trip] = await db
  .insert(trips)
  .values({
    name: "Marrakech May 2027",
    destination: "Marrakech, Morocco",
    startDate: "2027-05-14",
    endDate: "2027-05-18",
    organizerName: "Miguel Gomes",
    organizerEmail: "miguel@example.com",
    autopayLimitCents: 150_000,
  })
  .returning();
await db.insert(travellers).values(
  PEOPLE.map(([name, notes]) => ({
    tripId: trip.id,
    name,
    notes,
    email: `${name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}@example.com`,
  })),
);
console.log(`Trip ${trip.id}`);

const t0 = Date.now();
const { saved, warnings: w1 } = await importConfirmations(trip.id, CONFIRMATIONS);
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
