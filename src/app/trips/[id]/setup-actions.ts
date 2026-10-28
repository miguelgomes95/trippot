"use server";

import { refresh } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { buildInstalments, sendInvoices } from "@/lib/plan/instalments";
import { importConfirmations } from "@/lib/plan/save-bookings";
import { planSplit } from "@/lib/plan/split";
import { takeAllowance, visitor, type LimitedAction } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validate";

const { bookings, shares, travellers, instalments } = tables;

export type StepResult = { ok: boolean; messages: string[] };

const fail = (message: string): StepResult => ({ ok: false, messages: [message] });

/** Bookings and the split can change only until the first instalment exists. */
async function hasInstalments(tripId: string) {
  const people = await db.select({ id: travellers.id }).from(travellers).where(eq(travellers.tripId, tripId));
  if (!people.length) return false;
  const [one] = await db
    .select({ id: instalments.id })
    .from(instalments)
    .where(inArray(instalments.travellerId, people.map((p) => p.id)))
    .limit(1);
  return Boolean(one);
}

/** Returns a failed result when the visitor is over the demo's limit for `action`. */
async function overLimit(action: LimitedAction) {
  const blocked = await takeAllowance(action, await visitor());
  return blocked ? fail(blocked) : null;
}

const LOCKED = "Invoices are already planned for this trip, so its bookings can't change.";

export async function importBookings(tripId: string, text: string): Promise<StepResult> {
  const pasted = text.trim();
  if (!pasted) return fail("Paste at least one booking confirmation.");
  if (pasted.length > 20_000) return fail("That's too long. Paste up to about 10 confirmations at a time.");
  if (await hasInstalments(tripId)) return fail(LOCKED);
  const limited = await overLimit("extract");
  if (limited) return limited;
  try {
    const { saved, warnings } = await importConfirmations(tripId, pasted);
    refresh();
    if (!saved.length) return { ok: false, messages: ["No bookings found in that text.", ...warnings] };
    return { ok: true, messages: warnings };
  } catch (err) {
    console.error(err);
    return fail("The confirmations couldn't be read. Try again, or paste fewer at a time.");
  }
}

export async function setSupplierEmail(tripId: string, bookingId: string, email: string): Promise<StepResult> {
  const value = email.trim();
  if (!isValidEmail(value)) return fail(`"${value}" isn't an email PayPal accepts.`);
  const updated = await db
    .update(bookings)
    .set({ supplierPaypalEmail: value })
    .where(and(eq(bookings.id, bookingId), eq(bookings.tripId, tripId)))
    .returning({ id: bookings.id });
  if (!updated.length) return fail("That booking isn't part of this trip.");
  refresh();
  return { ok: true, messages: [] };
}

export async function removeBooking(tripId: string, bookingId: string): Promise<StepResult> {
  if (await hasInstalments(tripId)) return fail(LOCKED);
  await db.delete(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.tripId, tripId)));
  refresh();
  return { ok: true, messages: [] };
}

export async function planTripSplit(tripId: string): Promise<StepResult> {
  if (await hasInstalments(tripId)) return fail(LOCKED);
  const limited = await overLimit("split");
  if (limited) return limited;
  try {
    const { warnings } = await planSplit(tripId);
    refresh();
    return { ok: true, messages: warnings };
  } catch (err) {
    console.error(err);
    return fail(`The split couldn't be planned: ${(err as Error).message}`);
  }
}

/** Plans the instalments (once) and sends every invoice that hasn't gone out yet. */
export async function sendTripInvoices(tripId: string): Promise<StepResult> {
  const limited = await overLimit("invoices");
  if (limited) return limited;
  try {
    if (!(await hasInstalments(tripId))) {
      const tripBookings = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.tripId, tripId));
      const split = tripBookings.length
        ? await db.selectDistinct({ id: shares.bookingId }).from(shares).where(inArray(shares.bookingId, tripBookings.map((b) => b.id)))
        : [];
      if (!tripBookings.length || split.length < tripBookings.length) return fail("Plan the split for every booking first.");
      await buildInstalments(tripId);
    }
    const results = await sendInvoices(tripId);
    refresh();
    const failed = results.filter((r) => !r.ok);
    return {
      ok: failed.length === 0,
      messages: failed.length ? [`${failed.length} of ${results.length} invoices didn't go out.`, ...failed.map((f) => f.error!)] : [],
    };
  } catch (err) {
    console.error(err);
    return fail(`The invoices couldn't be sent: ${(err as Error).message}`);
  }
}
