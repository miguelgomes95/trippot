// End-to-end check of the pot + guardrails against the PayPal sandbox, no AI involved.
// Run: pnpm smoke:pot   (needs docker compose up -d and PayPal keys in .env)
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, tables } from "../src/db";
import { splitByWeights } from "../src/lib/money";
import { potBalance, refreshMilestoneFunding } from "../src/lib/pot";
import { payMilestone } from "../src/lib/agent/actions";

const { trips, travellers, bookings, supplierMilestones, instalments, payments, agentActions } = tables;

assert.deepEqual(splitByWeights(1000, [1, 1, 1]), [334, 333, 333]);
assert.equal(splitByWeights(99_999, [2, 1, 1, 1]).reduce((a, b) => a + b), 99_999);

const [trip] = await db
  .insert(trips)
  .values({
    name: "Smoke test trip",
    destination: "Marrakech",
    startDate: "2027-05-14",
    endDate: "2027-05-18",
    organizerName: "Org",
    organizerEmail: "org@example.com",
    autopayLimitCents: 50_000,
  })
  .returning();

try {
  const people = await db
    .insert(travellers)
    .values([
      { tripId: trip.id, name: "Ana Test", email: "ana@example.com" },
      { tripId: trip.id, name: "Rui Test", email: "rui@example.com" },
    ])
    .returning();
  const [riad] = await db
    .insert(bookings)
    .values({ tripId: trip.id, supplierName: "Riad Smoke", category: "lodging", totalCents: 120_000, supplierPaypalEmail: "riad.supplier@example.com" })
    .returning();
  const [deposit, balance] = await db
    .insert(supplierMilestones)
    .values([
      { bookingId: riad.id, label: "Deposit", amountCents: 30_000, dueDate: "2027-03-01" },
      { bookingId: riad.id, label: "Balance", amountCents: 90_000, dueDate: "2027-04-15" },
    ])
    .returning();
  const inst = await db
    .insert(instalments)
    .values(people.map((p) => ({ travellerId: p.id, label: "Riad share", amountCents: 60_000, dueDate: "2027-02-20", status: "sent" as const })))
    .returning();

  // 1. Empty pot: nothing funded, payout is blocked.
  assert.equal((await refreshMilestoneFunding(trip.id)).length, 0);
  const blocked = await payMilestone(trip.id, deposit.id, "smoke");
  assert.equal(blocked.ok, false, "payout must be blocked with an empty pot");

  // 2. Ana pays 400 €: the deposit (300 €) becomes funded, the balance (900 €) stays pending.
  await db.insert(payments).values({ instalmentId: inst[0].id, amountCents: 40_000 });
  await refreshMilestoneFunding(trip.id);
  const status = async (id: string) =>
    (await db.select().from(supplierMilestones).where(eq(supplierMilestones.id, id)))[0].status;
  assert.equal(await status(deposit.id), "funded");
  assert.equal(await status(balance.id), "pending");

  // 3. Paying the funded deposit goes through PayPal Payouts (sandbox).
  const paid = await payMilestone(trip.id, deposit.id, "smoke: deposit due");
  assert.equal(paid.ok, true, JSON.stringify(paid));
  assert.equal((await potBalance(trip.id)).balanceCents, 10_000);

  // 4. Everyone pays the rest: balance (900 €) is above the 500 € auto-pay limit → needs approval.
  await db.insert(payments).values([
    { instalmentId: inst[0].id, amountCents: 20_000 },
    { instalmentId: inst[1].id, amountCents: 60_000 },
  ]);
  await refreshMilestoneFunding(trip.id);
  assert.equal(await status(balance.id), "awaiting_approval");
  const needsApproval = await payMilestone(trip.id, balance.id, "smoke");
  assert.equal(needsApproval.ok, false, "above-limit payout must wait for the organizer");

  // 5. Retrying an already-paid milestone does nothing.
  assert.equal((await payMilestone(trip.id, deposit.id, "smoke")).ok, false);

  const log = await db.select().from(agentActions).where(eq(agentActions.tripId, trip.id));
  console.log("Audit log:");
  for (const a of log) console.log(`  [${a.kind}] ${a.summary}${a.reason ? ` (${a.reason})` : ""}`);
  console.log("✅ pot + guardrails smoke test passed");
} finally {
  await db.delete(trips).where(eq(trips.id, trip.id));
  process.exit(0);
}
