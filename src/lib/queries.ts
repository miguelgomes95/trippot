import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { tripOverview } from "./agent/overview";
import { DEMO_TRIP } from "./demo-data";

const { trips, travellers, bookings, supplierMilestones, shares, instalments, agentActions } = tables;

export async function tripsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(trips).where(inArray(trips.id, ids)).orderBy(desc(trips.createdAt));
}

/**
 * The seeded example trip, with its live numbers for the home page. Visitors can
 * create trips with the same name from the example form, so the oldest one wins.
 */
export async function exampleTrip() {
  const [trip] = await db.select().from(trips).where(eq(trips.name, DEMO_TRIP.name)).orderBy(asc(trips.createdAt)).limit(1);
  if (!trip) return null;
  const overview = await tripOverview(trip.id);
  return {
    id: trip.id,
    currency: trip.currency,
    travellers: overview.travellers.length,
    collectedCents: overview.pot.collectedCents,
    owedCents: overview.travellers.reduce((s, t) => s + t.owedCents, 0),
    suppliers: new Set(overview.supplierDeadlines.map((d) => d.bookingId)).size,
    suppliersPaid: overview.supplierDeadlines.filter((d) => d.status === "paid").length,
    supplierDeadlines: overview.supplierDeadlines.length,
  };
}

/** Everything the trip dashboard shows, in one call. */
export async function tripDashboard(tripId: string) {
  const overview = await tripOverview(tripId);
  const tripBookings = await db.select().from(bookings).where(eq(bookings.tripId, tripId)).orderBy(asc(bookings.startsOn));
  const activity = await db
    .select()
    .from(agentActions)
    .where(eq(agentActions.tripId, tripId))
    .orderBy(desc(agentActions.createdAt))
    .limit(40);
  const totalCents = tripBookings.reduce((a, b) => a + b.totalCents, 0);
  return { ...overview, bookings: tripBookings, activity, totalCents };
}

export type TripDashboard = Awaited<ReturnType<typeof tripDashboard>>;

/**
 * A trip is set up until every instalment has gone out as a PayPal invoice.
 * Returns what the setup steps need, or `live: true` once the dashboard should show instead.
 */
export async function tripSetup(tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) return null;
  const people = await db.select().from(travellers).where(eq(travellers.tripId, tripId)).orderBy(asc(travellers.name));
  const plan = people.length
    ? await db.select().from(instalments).where(inArray(instalments.travellerId, people.map((p) => p.id)))
    : [];
  const unsent = plan.filter((i) => i.status === "draft");
  if (plan.length && !unsent.length) return { live: true as const };

  const tripBookings = await db.select().from(bookings).where(eq(bookings.tripId, tripId)).orderBy(asc(bookings.createdAt));
  const ids = tripBookings.map((b) => b.id);
  const milestones = ids.length
    ? await db.select().from(supplierMilestones).where(inArray(supplierMilestones.bookingId, ids)).orderBy(asc(supplierMilestones.dueDate))
    : [];
  const tripShares = ids.length ? await db.select().from(shares).where(inArray(shares.bookingId, ids)) : [];
  // The split's explanation per booking is the reason on the latest "plan" entry for it.
  const planNotes = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.tripId, tripId), eq(agentActions.kind, "plan")))
    .orderBy(desc(agentActions.createdAt));
  const explanation = (bookingId: string) =>
    planNotes.find((a) => (a.payload as { bookingId?: string } | null)?.bookingId === bookingId)?.reason ?? null;

  return {
    live: false as const,
    trip,
    travellers: people,
    bookings: tripBookings.map((b) => ({
      ...b,
      milestones: milestones.filter((m) => m.bookingId === b.id),
      shares: tripShares.filter((s) => s.bookingId === b.id),
      explanation: explanation(b.id),
    })),
    instalments: { total: plan.length, unsent: unsent.length },
  };
}

export type TripSetup = Exclude<NonNullable<Awaited<ReturnType<typeof tripSetup>>>, { live: true }>;
