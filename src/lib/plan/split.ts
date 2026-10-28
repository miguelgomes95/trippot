import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db, tables } from "@/db";
import { AGENT_MODEL, claude, FALLBACK } from "../ai/claude";
import { logAction } from "../agent/actions";
import { formatMoney, splitByWeights } from "../money";

const { trips, travellers, bookings, shares, instalments } = tables;

// The model only makes the judgment calls (who takes part, who owes a supplement);
// all arithmetic happens in code so shares always add up to the booking total.
const SplitDecision = z.object({
  bookings: z.array(
    z.object({
      bookingId: z.string(),
      participantIds: z.array(z.string()).describe("Travellers who take part in and pay for this booking"),
      supplements: z
        .array(
          z.object({
            travellerId: z.string(),
            amount: z.number().describe("Extra amount in the trip currency, e.g. 90.00"),
            reason: z.string(),
          }),
        )
        .describe("Extra costs owed by specific travellers that are part of the booking total"),
      explanation: z.string().describe("One sentence the organizer will read"),
    }),
  ),
  warnings: z.array(z.string()).describe("Anything inconsistent, e.g. the confirmation says 9 participants but notes give 8"),
});

const SYSTEM = `You split the cost of a group trip's bookings between travellers.
For each booking decide who takes part and pays, and which travellers owe a supplement (e.g. a single room) that is already included in the booking total.
Use the traveller notes and the booking notes. By default everyone takes part.
Use only ids from the data. If headcounts or notes don't match, still give your best split and add a warning.`;

export async function planSplit(tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  const people = await db.select().from(travellers).where(eq(travellers.tripId, tripId)).orderBy(asc(travellers.name));
  const tripBookings = await db.select().from(bookings).where(eq(bookings.tripId, tripId));
  if (!people.length || !tripBookings.length) throw new Error("Add travellers and bookings first");

  const sent = await db
    .select({ id: instalments.id })
    .from(instalments)
    .where(inArray(instalments.travellerId, people.map((p) => p.id)));
  if (sent.length) throw new Error("Invoices already exist for this trip; the split can't be changed");

  const data = {
    currency: trip.currency,
    travellers: people.map((p) => ({ id: p.id, name: p.name, notes: p.notes })),
    bookings: tripBookings.map((b) => ({
      id: b.id,
      supplier: b.supplierName,
      category: b.category,
      total: b.totalCents / 100,
      notes: b.notes,
    })),
  };

  const response = await claude.beta.messages.parse({
    model: AGENT_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(SplitDecision) },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(data) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output)
    throw new Error(`Could not plan the split (stop_reason=${response.stop_reason})`);
  const decision = response.parsed_output;

  const validIds = new Set(people.map((p) => p.id));
  const warnings = [...decision.warnings];
  const rows: (typeof shares.$inferInsert)[] = [];

  for (const b of tripBookings) {
    const d = decision.bookings.find((x) => x.bookingId === b.id);
    const participants = (d?.participantIds ?? people.map((p) => p.id)).filter((id) => validIds.has(id));
    if (!d) warnings.push(`No decision for ${b.supplierName}; split equally between everyone`);
    if (!participants.length) {
      warnings.push(`${b.supplierName}: nobody selected; split equally between everyone`);
      participants.push(...people.map((p) => p.id));
    }

    const supplements = (d?.supplements ?? []).filter((s) => validIds.has(s.travellerId));
    const supplementCents = supplements.map((s) => Math.round(s.amount * 100));
    const extra = supplementCents.reduce((a, c) => a + c, 0);
    if (extra >= b.totalCents) throw new Error(`${b.supplierName}: supplements exceed the booking total`);

    const base = splitByWeights(b.totalCents - extra, participants.map(() => 1));
    const amounts = new Map(participants.map((id, i) => [id, base[i]]));
    supplements.forEach((s, i) => amounts.set(s.travellerId, (amounts.get(s.travellerId) ?? 0) + supplementCents[i]));

    const reasons = new Map(supplements.map((s) => [s.travellerId, s.reason]));
    for (const [travellerId, amountCents] of amounts)
      rows.push({ bookingId: b.id, travellerId, amountCents, reason: reasons.get(travellerId) ?? null });

    await logAction(
      tripId,
      "plan",
      `Split ${b.supplierName} (${formatMoney(b.totalCents, trip.currency)}) between ${amounts.size} travellers`,
      d?.explanation,
      { bookingId: b.id },
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(shares).where(inArray(shares.bookingId, tripBookings.map((b) => b.id)));
    await tx.insert(shares).values(rows);
  });
  return { shares: rows, warnings };
}
