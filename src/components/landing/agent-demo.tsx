"use client";

import { useState, type CSSProperties } from "react";
import { useInView } from "./use-in-view";

// A real exchange with the agent on the example trip, and real entries from its log,
// recorded on 28 Oct 2026 after the first round of payments.
const ANSWER = [
  "Eleven travellers still owe money for the balance instalment, due 5 Apr 2027:",
  "Diogo, Hugo, Inês, Joana, Marta, Miguel, Pedro and Rita each owe €327.75.",
  "Rui owes €390.75.",
  "Sofia and Tiago each owe €182.75.",
  "Ana has paid in full.",
  "The total outstanding is €3,600.50. No reminders have been sent yet.",
];

const LOG = [
  {
    dot: "bg-saffron",
    title: "Ana Ribeiro paid €182.75 for “Riad Dar Zitoun balance + Marrakech Transfers full payment”",
    meta: "Payment in, from a PayPal webhook",
  },
  {
    dot: "bg-teal",
    title: "Paid Riad Dar Zitoun €864.00 (30% deposit)",
    reason:
      "Riad Dar Zitoun 30% deposit (€864.00, due 2027-03-01) is funded, within the autopay limit, and the pot balance of €1,046.75 covers it.",
    meta: "Paid supplier with PayPal Payouts",
  },
  {
    dot: "bg-white",
    title:
      "I paid the Riad Dar Zitoun 30% deposit of €864.00 from the pot. It was funded, under the autopay limit, and covered by the pot balance. That leaves about €182.75 in the pot.",
    meta: "Agent, on its own: new payments funded a supplier deadline",
  },
];

const at = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

export function AgentDemo() {
  const [run, setRun] = useState(0);
  const [ref, seen] = useInView<HTMLDivElement>(0.35);

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-2">
      <div
        key={run}
        className={`reveal ${seen ? "reveal-on" : ""} flex min-h-[30rem] flex-col overflow-hidden rounded-2xl bg-surface text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-baseline justify-between border-b border-line px-5 py-3.5">
          <p className="font-display font-semibold">Ask TripPot</p>
          <p className="text-xs text-muted">Marrakech May 2027</p>
        </div>
        <div className="flex-1 space-y-4 px-5 py-5 text-[15px] leading-relaxed">
          <p className="chat-in ml-auto w-fit rounded-2xl rounded-br-md bg-ink px-4 py-2 text-white" style={at(0.3)}>
            Who still owes money?
          </p>
          <div className="chat-in flex items-center gap-2 text-sm text-muted" style={at(0.9)}>
            <span className="agent-spin size-3.5 rounded-full border-2 border-line border-t-violet" style={at(0.9)} aria-hidden />
            <span>
              Calling <code className="rounded bg-paper px-1.5 py-0.5 text-[13px] text-ink">get_trip_overview</code>
            </span>
            <span className="chat-in text-teal" style={at(2.1)}>
              done
            </span>
          </div>
          <div className="space-y-1">
            {ANSWER.map((line, i) => (
              <p key={i} className="chat-in" style={at(2.4 + i * 0.35)}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          <span className="text-muted">A real answer, from live data</span>
          <button
            type="button"
            onClick={() => setRun((n) => n + 1)}
            className="-mr-2 rounded-md px-2 py-1 font-medium text-violet hover:bg-violet-soft"
          >
            Replay
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 p-5">
        <p className="font-display font-semibold text-white">What it did on its own</p>
        <p className="mt-0.5 text-sm text-white/60">From the agent&rsquo;s log, newest last. Every action keeps its reason.</p>
        <ol className="mt-5 space-y-5">
          {LOG.map((e) => (
            <li key={e.title} className="flex gap-3">
              <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${e.dot} ring-2 ring-white/20`} />
              <div>
                <p className="text-white">{e.title}</p>
                {e.reason && <p className="mt-1 text-sm text-white/70">{e.reason}</p>}
                <p className="mt-1 text-xs text-white/50">{e.meta}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
