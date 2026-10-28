import "server-only";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { logAction } from "./agent/actions";
import { formatMoney, fromPayPalValue } from "./money";
import { refreshMilestoneFunding } from "./pot";
import { getInvoice } from "./paypal/invoices";

const { trips, travellers, instalments, payments, supplierMilestones, bookings } = tables;

const STATUS: Record<string, typeof instalments.$inferSelect.status> = {
  PAID: "paid",
  MARKED_AS_PAID: "paid",
  PARTIALLY_PAID: "partially_paid",
  CANCELLED: "cancelled",
};

/**
 * Pulls an invoice from PayPal (the source of truth, whatever event told us about it),
 * records any new payments, and re-checks which supplier deadlines the pot now covers.
 */
export async function syncInvoice(invoiceId: string) {
  const [row] = await db
    .select({ instalment: instalments, traveller: travellers, trip: trips })
    .from(instalments)
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .innerJoin(trips, eq(travellers.tripId, trips.id))
    .where(eq(instalments.paypalInvoiceId, invoiceId));
  if (!row) return null; // not one of ours
  const { instalment, traveller, trip } = row;

  const invoice = await getInvoice(invoiceId);
  const transactions = (invoice.payments?.transactions ?? []).filter((t) => t.amount && t.payment_id);
  let newCents = 0;
  for (const t of transactions) {
    const inserted = await db
      .insert(payments)
      .values({
        instalmentId: instalment.id,
        amountCents: fromPayPalValue(t.amount!.value),
        paypalTransactionId: t.payment_id,
        receivedAt: t.payment_date_time ? new Date(t.payment_date_time) : new Date(),
      })
      .onConflictDoNothing({ target: payments.paypalTransactionId })
      .returning();
    newCents += inserted.reduce((a, p) => a + p.amountCents, 0);
  }

  const paidCents = fromPayPalValue(invoice.payments?.paid_amount?.value ?? "0");
  await db
    .update(instalments)
    .set({ paidCents, status: STATUS[invoice.status] ?? instalment.status })
    .where(eq(instalments.id, instalment.id));

  if (newCents > 0)
    await logAction(
      trip.id,
      "payment_received",
      `${traveller.name} paid ${formatMoney(newCents, trip.currency)} for "${instalment.label}"`,
      undefined,
      { instalmentId: instalment.id, invoiceId },
    );

  const changed = await refreshMilestoneFunding(trip.id);
  return { tripId: trip.id, newCents, changed };
}

/** Applies a payout outcome to the milestone it paid. Failed payouts go back to the queue. */
export async function syncPayout(batchId: string, outcome: "succeeded" | "failed", detail?: string) {
  const [row] = await db
    .select({ milestone: supplierMilestones, booking: bookings })
    .from(supplierMilestones)
    .innerJoin(bookings, eq(supplierMilestones.bookingId, bookings.id))
    .where(eq(supplierMilestones.payoutBatchId, batchId));
  if (!row || outcome === "succeeded") return;
  await db
    .update(supplierMilestones)
    .set({ status: "failed", paidAt: null })
    .where(eq(supplierMilestones.id, row.milestone.id));
  await logAction(
    row.booking.tripId,
    "payout_failed",
    `PayPal could not pay ${row.booking.supplierName} (${row.milestone.label})`,
    detail,
    { milestoneId: row.milestone.id, batchId },
  );
}
