import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { potBalance } from "../pot";

const { trips, travellers, bookings, supplierMilestones, instalments } = tables;

/** A compact snapshot of a trip's money, used as the agent's context and by the dashboard. */
export async function tripOverview(tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) throw new Error("Trip not found");

  const people = await db.select().from(travellers).where(eq(travellers.tripId, tripId)).orderBy(asc(travellers.name));
  const plan = await db
    .select({ instalment: instalments, travellerId: travellers.id })
    .from(instalments)
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .where(eq(travellers.tripId, tripId))
    .orderBy(asc(instalments.dueDate));
  const deadlines = await db
    .select({ milestone: supplierMilestones, supplierName: bookings.supplierName })
    .from(supplierMilestones)
    .innerJoin(bookings, eq(supplierMilestones.bookingId, bookings.id))
    .where(eq(bookings.tripId, tripId))
    .orderBy(asc(supplierMilestones.dueDate));

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      dates: `${trip.startDate} → ${trip.endDate}`,
      currency: trip.currency,
      autopay: { enabled: trip.autopayEnabled, limitCents: trip.autopayLimitCents },
    },
    pot: await potBalance(tripId),
    travellers: people.map((p) => {
      const mine = plan.filter((r) => r.travellerId === p.id).map((r) => r.instalment);
      return {
        id: p.id,
        name: p.name,
        notes: p.notes,
        owedCents: mine.reduce((s, i) => s + i.amountCents, 0),
        paidCents: mine.reduce((s, i) => s + i.paidCents, 0),
        instalments: mine.map((i) => ({
          id: i.id,
          label: i.label,
          amountCents: i.amountCents,
          paidCents: i.paidCents,
          dueDate: i.dueDate,
          status: i.status,
          lastReminderAt: i.lastReminderAt,
        })),
      };
    }),
    supplierDeadlines: deadlines.map(({ milestone, supplierName }) => ({
      id: milestone.id,
      supplier: supplierName,
      label: milestone.label,
      amountCents: milestone.amountCents,
      dueDate: milestone.dueDate,
      status: milestone.status,
    })),
  };
}
