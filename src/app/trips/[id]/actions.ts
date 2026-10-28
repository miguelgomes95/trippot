"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { payMilestone } from "@/lib/agent/actions";
import { onMilestonesChanged } from "@/lib/agent/autopilot";
import { runAgent } from "@/lib/agent/run";
import { recordPayment } from "@/lib/paypal/invoices";
import { syncInvoice } from "@/lib/sync";

const { instalments, travellers, trips } = tables;

export type ChatTurn = { role: "user" | "assistant"; text: string };

export async function askAgent(tripId: string, question: string, history: ChatTurn[]) {
  const text = question.trim().slice(0, 1000);
  if (!text) return { answer: "" };
  const { answer } = await runAgent(
    tripId,
    text,
    history.slice(-8).map((t) => ({ role: t.role, content: t.text })),
  );
  refresh();
  return { answer };
}

/**
 * Demo control: pays an instalment in the PayPal sandbox as the traveller would,
 * then syncs it the same way the webhook does.
 */
export async function simulatePayment(tripId: string, instalmentId: string) {
  const [row] = await db
    .select({ instalment: instalments, currency: trips.currency, tripId: trips.id })
    .from(instalments)
    .innerJoin(travellers, eq(instalments.travellerId, travellers.id))
    .innerJoin(trips, eq(travellers.tripId, trips.id))
    .where(eq(instalments.id, instalmentId));
  // The instalment must belong to the trip the request came from.
  if (!row || row.tripId !== tripId || row.instalment.status === "paid" || !row.instalment.paypalInvoiceId) return;
  const { instalment, currency } = row;

  await recordPayment(instalment.paypalInvoiceId!, instalment.amountCents - instalment.paidCents, currency);
  const result = await syncInvoice(instalment.paypalInvoiceId!);
  if (result?.changed.length) after(() => onMilestonesChanged(result.tripId, result.changed));
  refresh();
}

export async function approvePayment(tripId: string, milestoneId: string) {
  await payMilestone(tripId, milestoneId, "Approved by the organizer", true);
  refresh();
}
