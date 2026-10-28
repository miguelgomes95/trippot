import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { logAction } from "../agent/actions";
import { formatMoney, splitByWeights } from "../money";
import { createAndSendInvoice } from "../paypal/invoices";

const { trips, travellers, bookings, supplierMilestones, shares, instalments } = tables;

// Travellers pay this many days before the supplier deadline, so the pot is funded in time.
export const PAY_BUFFER_DAYS = 10;
const MIN_NOTICE_DAYS = 7;
const MERGE_WINDOW_DAYS = 21;

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Turns shares into instalments: each traveller's share of a booking is spread over
 * the booking's supplier deadlines, due PAY_BUFFER_DAYS earlier. Same due date → one instalment.
 */
export async function buildInstalments(tripId: string, today = new Date().toISOString().slice(0, 10)) {
  const people = await db.select().from(travellers).where(eq(travellers.tripId, tripId));
  const tripBookings = await db.select().from(bookings).where(eq(bookings.tripId, tripId));
  const bookingIds = tripBookings.map((b) => b.id);
  const existing = await db.select({ id: instalments.id }).from(instalments).where(inArray(instalments.travellerId, people.map((p) => p.id)));
  if (existing.length) throw new Error("Instalments already exist for this trip");

  const milestones = await db
    .select()
    .from(supplierMilestones)
    .where(inArray(supplierMilestones.bookingId, bookingIds))
    .orderBy(asc(supplierMilestones.dueDate));
  const tripShares = await db.select().from(shares).where(inArray(shares.bookingId, bookingIds));
  const earliest = addDays(today, MIN_NOTICE_DAYS);

  // travellerId → dueDate → { cents, labels }
  const plan = new Map<string, Map<string, { cents: number; labels: Set<string> }>>();
  for (const share of tripShares) {
    const booking = tripBookings.find((b) => b.id === share.bookingId)!;
    const ms = milestones.filter((m) => m.bookingId === share.bookingId);
    const parts = splitByWeights(share.amountCents, ms.map((m) => m.amountCents));
    ms.forEach((m, i) => {
      if (!parts[i]) return;
      const buffered = addDays(m.dueDate, -PAY_BUFFER_DAYS);
      const due = buffered < earliest ? earliest : buffered;
      const byDate = plan.get(share.travellerId) ?? new Map();
      const slot = byDate.get(due) ?? { cents: 0, labels: new Set<string>() };
      slot.cents += parts[i];
      slot.labels.add(`${booking.supplierName} ${m.label.toLowerCase()}`);
      byDate.set(due, slot);
      plan.set(share.travellerId, byDate);
    });
  }

  const rows: (typeof instalments.$inferInsert)[] = [];
  for (const [travellerId, byDate] of plan) {
    // Deadlines close together become one invoice, due on the earlier date.
    const merged: { dueDate: string; cents: number; labels: Set<string> }[] = [];
    for (const [dueDate, slot] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
      const last = merged.at(-1);
      if (last && dueDate <= addDays(last.dueDate, MERGE_WINDOW_DAYS)) {
        last.cents += slot.cents;
        slot.labels.forEach((l) => last.labels.add(l));
      } else merged.push({ dueDate, cents: slot.cents, labels: new Set(slot.labels) });
    }
    for (const m of merged)
      rows.push({ travellerId, dueDate: m.dueDate, amountCents: m.cents, label: [...m.labels].join(" + ") });
  }
  if (rows.length) await db.insert(instalments).values(rows);

  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  await logAction(
    tripId,
    "plan",
    `Planned ${rows.length} instalments for ${plan.size} travellers (${formatMoney(total, trip.currency)})`,
    `Each instalment is due ${PAY_BUFFER_DAYS} days before the supplier deadline it covers`,
  );
  return rows;
}

/** Creates and sends a PayPal invoice for every draft instalment of the trip. */
export async function sendInvoices(tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  const drafts = await db
    .select({ instalment: instalments, traveller: travellers })
    .from(instalments)
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .where(and(eq(travellers.tripId, tripId), eq(instalments.status, "draft"), isNull(instalments.paypalInvoiceId)));

  const results: { instalmentId: string; ok: boolean; error?: string }[] = [];
  // A few at a time to stay well under PayPal's rate limits.
  for (let i = 0; i < drafts.length; i += 4) {
    await Promise.all(
      drafts.slice(i, i + 4).map(async ({ instalment, traveller }) => {
        try {
          const { invoiceId, payerUrl } = await createAndSendInvoice({
            instalmentId: instalment.id,
            tripName: trip.name,
            organizerName: trip.organizerName,
            label: instalment.label,
            travellerName: traveller.name,
            travellerEmail: traveller.email,
            amountCents: instalment.amountCents,
            currency: trip.currency,
            dueDate: instalment.dueDate,
            note: `Organised by ${trip.organizerName} with TripPot. You can pay in parts before the due date.`,
          });
          await db
            .update(instalments)
            .set({ paypalInvoiceId: invoiceId, paypalPayerUrl: payerUrl, status: "sent" })
            .where(eq(instalments.id, instalment.id));
          results.push({ instalmentId: instalment.id, ok: true });
        } catch (err) {
          results.push({ instalmentId: instalment.id, ok: false, error: (err as Error).message });
        }
      }),
    );
  }
  const ok = results.filter((r) => r.ok).length;
  await logAction(
    tripId,
    "invoice_sent",
    `Sent ${ok} PayPal invoice${ok === 1 ? "" : "s"}${ok < results.length ? `, ${results.length - ok} failed` : ""}`,
    undefined,
    { failed: results.filter((r) => !r.ok) },
  );
  return results;
}
