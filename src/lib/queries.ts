import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { tripOverview } from "./agent/overview";

const { trips, bookings, agentActions } = tables;

export async function listTrips() {
  return db.select().from(trips).orderBy(desc(trips.createdAt));
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
