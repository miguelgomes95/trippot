"use server";

import { redirect } from "next/navigation";
import { db, tables } from "@/db";
import { takeAllowance, visitor } from "@/lib/rate-limit";
import { isValidEmail, parseTravellers } from "@/lib/validate";

const { trips, travellers } = tables;

const CURRENCIES = ["EUR", "USD", "GBP"];
const FIELDS = ["name", "destination", "startDate", "endDate", "currency", "organizerName", "organizerEmail", "autopayLimit", "travellers"] as const;

export type NewTripValues = Record<(typeof FIELDS)[number], string>;
export type NewTripState = { values: NewTripValues; errors: string[] } | null;

export async function createTrip(_prev: NewTripState, form: FormData): Promise<NewTripState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "").trim()])) as NewTripValues;
  const errors: string[] = [];

  if (!values.name) errors.push("Give the trip a name.");
  if (!values.destination) errors.push("Add where you're going.");
  if (!values.startDate || !values.endDate) errors.push("Add the first and last day of the trip.");
  else if (values.endDate < values.startDate) errors.push("The last day comes before the first day.");
  if (!CURRENCIES.includes(values.currency)) errors.push("Choose a currency.");
  if (!values.organizerName) errors.push("Add your name. Travellers see it on their invoices.");
  if (!isValidEmail(values.organizerEmail)) errors.push("Add an email for yourself, without accents.");
  const limit = Number(values.autopayLimit);
  if (!Number.isFinite(limit) || limit < 0) errors.push("The autopay limit must be a number, 0 or more.");

  const parsed = parseTravellers(values.travellers);
  errors.push(...parsed.errors);
  if (errors.length) return { values, errors };
  const blocked = await takeAllowance("trip", await visitor());
  if (blocked) return { values, errors: [blocked] };

  const tripId = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        name: values.name,
        destination: values.destination,
        startDate: values.startDate,
        endDate: values.endDate,
        currency: values.currency,
        organizerName: values.organizerName,
        organizerEmail: values.organizerEmail,
        autopayLimitCents: Math.round(limit * 100),
      })
      .returning({ id: trips.id });
    await tx.insert(travellers).values(parsed.travellers.map((t) => ({ ...t, tripId: trip.id })));
    return trip.id;
  });
  redirect(`/trips/${tripId}`);
}
