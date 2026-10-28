"use client";

import { useTransition } from "react";
import { approvePayment, simulatePayment } from "@/app/trips/[id]/actions";

export function SimulatePaymentButton({ tripId, instalmentId }: { tripId: string; instalmentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => simulatePayment(tripId, instalmentId))}
      disabled={pending}
      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:border-ink disabled:opacity-50"
      title="Pays this invoice in the PayPal sandbox, as the traveller would"
    >
      {pending ? "Paying…" : "Pay as traveller"}
    </button>
  );
}

export function ApproveButton({ tripId, milestoneId }: { tripId: string; milestoneId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => approvePayment(tripId, milestoneId))}
      disabled={pending}
      className="rounded-md bg-violet px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
    >
      {pending ? "Paying…" : "Approve and pay"}
    </button>
  );
}
