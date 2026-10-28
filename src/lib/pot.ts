import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, tables } from "@/db";

const { trips, travellers, bookings, supplierMilestones, instalments, payments } = tables;

/** Money collected from travellers minus money already paid to suppliers. */
export async function potBalance(tripId: string) {
  const [collected] = await db
    .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .innerJoin(instalments, eq(payments.instalmentId, instalments.id))
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .where(eq(travellers.tripId, tripId));
  const [paidOut] = await db
    .select({ cents: sql<number>`coalesce(sum(${supplierMilestones.amountCents}), 0)::int` })
    .from(supplierMilestones)
    .innerJoin(bookings, eq(supplierMilestones.bookingId, bookings.id))
    .where(and(eq(bookings.tripId, tripId), eq(supplierMilestones.status, "paid")));
  return { collectedCents: collected.cents, paidOutCents: paidOut.cents, balanceCents: collected.cents - paidOut.cents };
}

/**
 * Walks unpaid supplier milestones in due-date order and marks the ones the pot
 * can cover as `funded`, reserving money for earlier deadlines first.
 * Milestones above the trip's auto-pay limit become `awaiting_approval` instead.
 * Returns the milestones whose status changed.
 */
export async function refreshMilestoneFunding(tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  const { balanceCents } = await potBalance(tripId);

  const open = await db
    .select({ milestone: supplierMilestones })
    .from(supplierMilestones)
    .innerJoin(bookings, eq(supplierMilestones.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.tripId, tripId),
        inArray(supplierMilestones.status, ["pending", "funded", "awaiting_approval"]),
      ),
    )
    .orderBy(asc(supplierMilestones.dueDate));

  let available = balanceCents;
  const changed: (typeof supplierMilestones.$inferSelect)[] = [];
  for (const { milestone } of open) {
    let next: typeof milestone.status = "pending";
    if (available >= milestone.amountCents) {
      available -= milestone.amountCents;
      next =
        trip.autopayEnabled && milestone.amountCents <= trip.autopayLimitCents ? "funded" : "awaiting_approval";
    } else {
      // Stop at the first deadline we can't cover so later ones don't jump the queue.
      available = 0;
    }
    if (next !== milestone.status) {
      await db.update(supplierMilestones).set({ status: next }).where(eq(supplierMilestones.id, milestone.id));
      changed.push({ ...milestone, status: next });
    }
  }
  return changed;
}
