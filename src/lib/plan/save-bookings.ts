import "server-only";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { extractBookings, type ExtractedBooking } from "../ai/extract-bookings";
import { logAction } from "../agent/actions";
import { formatMoney, splitByWeights } from "../money";

const { trips, bookings, supplierMilestones } = tables;

const toCents = (amount: number) => Math.round(amount * 100);

/** Milestone amounts in cents that always add up to the booking total, whatever the model's rounding. */
function milestoneCents(b: ExtractedBooking) {
  const total = toCents(b.total);
  const raw = b.milestones.map((m) => toCents(m.amount));
  const sum = raw.reduce((a, c) => a + c, 0);
  if (raw.length === 0) return [];
  if (sum === total) return raw;
  return splitByWeights(total, raw.length && sum > 0 ? raw : raw.map(() => 1));
}

/** Reads pasted confirmations with the model and stores each booking and its supplier deadlines. */
export async function importConfirmations(tripId: string, text: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) throw new Error("Trip not found");

  const extracted = await extractBookings(
    text,
    `${trip.name}, ${trip.destination}, ${trip.startDate} to ${trip.endDate}, currency ${trip.currency}`,
  );

  const saved = [];
  const warnings: string[] = [];
  for (const b of extracted) {
    if (b.currency.toUpperCase() !== trip.currency) {
      warnings.push(`${b.supplierName} is in ${b.currency}, the trip uses ${trip.currency}; skipped`);
      continue;
    }
    const [booking] = await db
      .insert(bookings)
      .values({
        tripId,
        supplierName: b.supplierName,
        category: b.category,
        totalCents: toCents(b.total),
        supplierPaypalEmail: b.supplierPaypalEmail,
        startsOn: b.startsOn,
        endsOn: b.endsOn,
        cancellationPolicy: b.cancellationPolicy,
        notes: b.perPersonNotes,
        sourceText: text,
      })
      .returning();

    const milestones = b.milestones.length
      ? b.milestones
      : [{ label: "Full payment", amount: b.total, dueDate: b.startsOn ?? trip.startDate }];
    const cents = milestoneCents({ ...b, milestones });
    await db.insert(supplierMilestones).values(
      milestones.map((m, i) => ({ bookingId: booking.id, label: m.label, amountCents: cents[i], dueDate: m.dueDate })),
    );
    if (!b.supplierPaypalEmail) warnings.push(`${b.supplierName} has no PayPal email; add it before the agent can pay`);

    await logAction(
      tripId,
      "extract",
      `Read ${b.supplierName}: ${formatMoney(booking.totalCents, trip.currency)} in ${milestones.length} payment(s)`,
      undefined,
      { bookingId: booking.id },
    );
    saved.push({ booking, perPersonNotes: b.perPersonNotes });
  }
  return { saved, warnings };
}
