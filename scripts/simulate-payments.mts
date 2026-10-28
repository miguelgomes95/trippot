// Pays every traveller's earliest unpaid instalment in the PayPal sandbox and delivers the matching
// webhook to the local app, like PayPal would. Each run is one payment round: the first funds the
// riad deposit, the second the April deadlines (the riad balance needs the organizer's approval).
// Run (with `pnpm dev` running and PAYPAL_WEBHOOK_SKIP_VERIFY=true): pnpm simulate:payments
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "../src/db";
import { recordPayment } from "../src/lib/paypal/invoices";

const { trips, travellers, instalments, agentActions } = tables;
const APP = process.env.APP_URL ?? "http://localhost:3100";

const [trip] = await db.select().from(trips).where(eq(trips.name, "Marrakech May 2027"));
if (!trip) throw new Error("Run pnpm seed:demo --send first");

const rows = await db
  .select({ instalment: instalments, traveller: travellers })
  .from(instalments)
  .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
  .where(eq(travellers.tripId, trip.id))
  .orderBy(asc(instalments.dueDate));
const seen = new Set<string>();
const earliest = rows
  .filter((r) => r.instalment.status !== "paid" && r.instalment.status !== "cancelled")
  .filter((r) => !seen.has(r.traveller.id) && seen.add(r.traveller.id));

for (const { instalment, traveller } of earliest) {
  if (!instalment.paypalInvoiceId) continue;
  // Skips the payment if PayPal already has it (e.g. a re-run); the webhook then just syncs.
  await recordPayment(instalment.paypalInvoiceId, instalment.amountCents - instalment.paidCents, trip.currency).catch(
    (err) => console.log(`  (payment not recorded: ${err.message})`),
  );
  const res = await fetch(`${APP}/api/webhooks/paypal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `WH-SIM-${randomUUID()}`,
      event_type: "INVOICING.INVOICE.PAID",
      resource: { invoice: { id: instalment.paypalInvoiceId } },
    }),
  });
  console.log(`${traveller.name.padEnd(14)} paid "${instalment.label}" → webhook ${res.status}`);
}

console.log("\nWaiting for the agent…");
await new Promise((r) => setTimeout(r, 45_000));
const log = await db.select().from(agentActions).where(eq(agentActions.tripId, trip.id)).orderBy(asc(agentActions.createdAt));
for (const a of log.filter((a) => !["extract", "plan", "invoice_sent"].includes(a.kind)).slice(-8))
  console.log(`[${a.kind}] ${a.summary}${a.reason ? `\n      ↳ ${a.reason}` : ""}`);
process.exit(0);
