import "server-only";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { formatMoney } from "../money";
import { potBalance, refreshMilestoneFunding } from "../pot";
import { paySupplier } from "../paypal/payouts";
import { sendReminder } from "../paypal/invoices";

const { trips, travellers, bookings, supplierMilestones, instalments, agentActions } = tables;

// Guardrails live here, in code, not in the prompt: the agent can ask for anything,
// these functions decide what actually happens.

const REMINDER_COOLDOWN_MS = 24 * 3600 * 1000;

export async function logAction(
  tripId: string,
  kind: string,
  summary: string,
  reason?: string,
  payload?: unknown,
) {
  await db.insert(agentActions).values({ tripId, kind, summary, reason, payload });
}

export async function remindTraveller(tripId: string, instalmentId: string, subject: string, note: string, reason: string) {
  const [row] = await db
    .select({ instalment: instalments, traveller: travellers })
    .from(instalments)
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .where(and(eq(instalments.id, instalmentId), eq(travellers.tripId, tripId)));
  if (!row) return { ok: false, error: "Instalment not found in this trip" };
  const { instalment, traveller } = row;
  if (!instalment.paypalInvoiceId) return { ok: false, error: "Instalment has no PayPal invoice yet" };
  if (instalment.status === "paid" || instalment.status === "cancelled")
    return { ok: false, error: `Instalment is ${instalment.status}; no reminder needed` };
  if (instalment.lastReminderAt && Date.now() - instalment.lastReminderAt.getTime() < REMINDER_COOLDOWN_MS)
    return { ok: false, error: "Already reminded in the last 24 hours" };

  await sendReminder(instalment.paypalInvoiceId, subject, note);
  await db.update(instalments).set({ lastReminderAt: new Date() }).where(eq(instalments.id, instalmentId));
  await logAction(tripId, "reminder_sent", `Reminded ${traveller.name} about "${instalment.label}"`, reason, {
    instalmentId,
    subject,
    note,
  });
  return { ok: true };
}

export async function payMilestone(tripId: string, milestoneId: string, reason: string, approvedByOrganizer = false) {
  await refreshMilestoneFunding(tripId);
  const [row] = await db
    .select({ milestone: supplierMilestones, booking: bookings, trip: trips })
    .from(supplierMilestones)
    .innerJoin(bookings, eq(supplierMilestones.bookingId, bookings.id))
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .where(and(eq(supplierMilestones.id, milestoneId), eq(bookings.tripId, tripId)));
  if (!row) return { ok: false, error: "Milestone not found in this trip" };
  const { milestone, booking, trip } = row;

  const block = async (why: string) => {
    await logAction(tripId, "payout_blocked", `Did not pay ${booking.supplierName} (${milestone.label})`, why, {
      milestoneId,
    });
    return { ok: false, error: why };
  };

  if (milestone.status === "paid") return { ok: false, error: "Already paid" };
  if (!booking.supplierPaypalEmail) return block("Supplier has no PayPal email on file");
  if (milestone.status === "awaiting_approval" && !approvedByOrganizer)
    return block(
      `Amount ${formatMoney(milestone.amountCents, trip.currency)} is above the auto-pay limit of ${formatMoney(trip.autopayLimitCents, trip.currency)}; waiting for the organizer's approval`,
    );
  if (milestone.status === "pending") {
    const { balanceCents } = await potBalance(tripId);
    return block(
      `Pot has ${formatMoney(balanceCents, trip.currency)}, not enough to cover this and earlier deadlines`,
    );
  }

  const payout = await paySupplier({
    milestoneId,
    supplierEmail: booking.supplierPaypalEmail,
    amountCents: milestone.amountCents,
    currency: trip.currency,
    note: `${trip.name}: ${milestone.label}`,
  });
  await db
    .update(supplierMilestones)
    .set({ status: "paid", paidAt: new Date(), payoutBatchId: payout.batchId })
    .where(eq(supplierMilestones.id, milestoneId));
  await logAction(
    tripId,
    "payout_sent",
    `Paid ${booking.supplierName} ${formatMoney(milestone.amountCents, trip.currency)} (${milestone.label})`,
    reason,
    { milestoneId, payoutBatchId: payout.batchId },
  );
  await refreshMilestoneFunding(tripId);
  return { ok: true, payoutBatchId: payout.batchId };
}
