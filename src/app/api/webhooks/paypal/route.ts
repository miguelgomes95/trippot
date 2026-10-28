import { after } from "next/server";
import { db, tables } from "@/db";
import { onMilestonesChanged } from "@/lib/agent/autopilot";
import { verifyWebhook } from "@/lib/paypal/webhooks";
import { syncInvoice, syncPayout } from "@/lib/sync";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    invoice?: { id?: string };
    batch_header?: { payout_batch_id?: string };
    payout_batch_id?: string;
    errors?: { message?: string };
  };
};

// Local testing only: lets scripts post events without PayPal's signature. Never honoured in production.
const skipVerify = process.env.NODE_ENV !== "production" && process.env.PAYPAL_WEBHOOK_SKIP_VERIFY === "true";

export async function POST(request: Request) {
  const event = (await request.json()) as PayPalEvent;
  if (!skipVerify && !(await verifyWebhook(request.headers, event)))
    return Response.json({ error: "invalid signature" }, { status: 401 });

  // PayPal retries deliveries; the event id makes processing happen once.
  const inserted = await db
    .insert(tables.webhookEvents)
    .values({ id: event.id, type: event.event_type, payload: event })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return Response.json({ ok: true, duplicate: true });

  const type = event.event_type;
  if (type.startsWith("INVOICING.INVOICE.")) {
    const invoiceId = event.resource?.invoice?.id ?? event.resource?.id;
    if (invoiceId) {
      const result = await syncInvoice(invoiceId);
      // Answer PayPal right away; the agent (a model call) runs after the response.
      if (result?.changed.length) after(() => onMilestonesChanged(result.tripId, result.changed));
    }
  } else if (type.startsWith("PAYMENT.PAYOUTS")) {
    const batchId = event.resource?.batch_header?.payout_batch_id ?? event.resource?.payout_batch_id;
    const failed = /DENIED|FAILED|BLOCKED|RETURNED|CANCELED|REFUNDED/.test(type);
    if (batchId) await syncPayout(batchId, failed ? "failed" : "succeeded", event.resource?.errors?.message);
  }
  return Response.json({ ok: true });
}
