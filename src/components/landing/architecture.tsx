"use client";

import type { CSSProperties } from "react";
import { useInView } from "./use-in-view";

// The path money and data take through TripPot, lit up in order once it's on screen.
type Kind = "claude" | "paypal" | "code" | "people";
const NODES: { kind: Kind; name: string; detail: string }[] = [
  { kind: "people", name: "Confirmation emails", detail: "Pasted by the organizer" },
  { kind: "claude", name: "Read the bookings", detail: "Claude Haiku 5.5, structured output" },
  { kind: "claude", name: "Plan the split", detail: "Claude Opus 5.5, structured output" },
  { kind: "code", name: "Shares and instalments", detail: "Integer cents, largest remainder" },
  { kind: "paypal", name: "Invoices", detail: "PayPal Invoicing v2, partial payments" },
  { kind: "people", name: "Travellers pay", detail: "Each from their own invoice" },
  { kind: "paypal", name: "Webhooks", detail: "Signature checked, duplicates ignored" },
  { kind: "code", name: "The pot", detail: "Funds deadlines in date order" },
  { kind: "code", name: "Guardrails", detail: "Funded, under the limit, paid once" },
  { kind: "paypal", name: "Payouts", detail: "Batch id derived from the deadline" },
];

const STYLE: Record<Kind, { tag: string; label: string }> = {
  claude: { tag: "bg-saffron-soft text-ink", label: "Claude" },
  paypal: { tag: "bg-teal-soft text-teal", label: "PayPal" },
  code: { tag: "bg-ink text-white", label: "Our code" },
  people: { tag: "bg-paper text-muted", label: "People" },
};

export function Architecture() {
  const [ref, seen] = useInView<HTMLOListElement>(0.3);
  return (
    <div>
      <ol
        ref={ref}
        className={`reveal ${seen ? "reveal-on" : ""} grid gap-3 sm:grid-cols-2 lg:grid-cols-5`}
        aria-label="How money and data move through TripPot"
      >
        {NODES.map((n, i) => (
          <li
            key={n.name}
            className={`arch-node relative flex flex-col rounded-xl bg-surface p-4 ${
              n.name === "Guardrails" ? "ring-2 ring-ink" : "ring-1 ring-line"
            }`}
            style={{ animationDelay: `${0.15 + i * 0.18}s` } as CSSProperties}
          >
            <div className="flex items-center justify-between">
              <span className="num font-display text-sm font-semibold text-muted">{i + 1}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[n.kind].tag}`}>
                {STYLE[n.kind].label}
              </span>
            </div>
            <p className="mt-3 font-display text-lg leading-tight font-semibold">{n.name}</p>
            <p className="mt-1 text-sm text-muted">{n.detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-muted">
        Claude makes the judgment calls: what a confirmation says, who takes part in what, what to answer. Amounts, due
        dates and balances are computed in code, and only code can release a payout.
      </p>
    </div>
  );
}
