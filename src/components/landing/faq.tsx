const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "Does real money move in the demo?",
    a: "No. Everything runs in the PayPal sandbox. The invoices, payments and payouts are real PayPal API calls, made with test accounts.",
  },
  {
    q: "Can the AI pay the wrong supplier, or pay twice?",
    a: "The agent can only ask to pay a deadline the pot has already covered, to the payee read from that booking. The code checks the pot, the autopay limit and the deadline's status before anything goes out, and the Payouts batch id comes from the deadline, so PayPal refuses a second payout for it.",
  },
  {
    q: "What does the AI decide, and what doesn't it?",
    a: "Claude reads the confirmation emails, decides who takes part in each booking and who owes a supplement, and answers questions. It never does the sums: shares, instalments and balances are calculated in code, to the cent.",
  },
  {
    q: "What happens when someone doesn't pay?",
    a: "Their invoice stays open and accepts partial payments. The agent can remind them, at most once a day per invoice. Suppliers are only paid once the pot covers each deadline, so a late payer delays a payout instead of the organizer paying it from their own card.",
  },
  {
    q: "What if PayPal refuses a payout?",
    a: "The money stays set aside for that supplier, the refusal is logged with PayPal's reason, and the organizer can try again with Pay now.",
  },
  {
    q: "Who decides on the big payments?",
    a: "The organizer sets an autopay limit when creating the trip. Anything above it waits for them to press Approve and pay.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {QUESTIONS.map(({ q, a }) => (
        <details key={q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
            {q}
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-line transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="max-w-[44rem] pb-5 text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
