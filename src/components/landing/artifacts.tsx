// What each step does to the example trip, drawn as the small piece of UI it produces.
// The figures are the example trip's own.

const card = "rounded-xl bg-surface shadow-[0_1px_0_rgba(24,32,46,0.06),0_12px_32px_-16px_rgba(24,32,46,0.25)]";
const mark = "rounded-sm bg-saffron-soft px-0.5 shadow-[inset_0_-2px_0_var(--color-saffron)]";

export function EmailArtifact() {
  return (
    <div className="space-y-3">
      <div className={`${card} p-5 text-sm`}>
        <p className="text-muted">From reservations@riad-dar-zitoun.example</p>
        <p className="mt-0.5 font-medium">Booking confirmed: Riad Dar Zitoun, 14 to 18 May 2027</p>
        <p className="mt-3 text-muted">
          Total: <span className={`${mark} text-ink`}>2,880.00 EUR</span> (breakfast included). Payment schedule:{" "}
          <span className={`${mark} text-ink`}>30% deposit due by 1 March 2027</span>,{" "}
          <span className={`${mark} text-ink`}>remaining balance due 15 April 2027</span>. Payments via PayPal to
          payments@riad-dar-zitoun.example.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pl-5 text-sm">
        <Chip label="Deposit" amount="€864.00" when="by 1 Mar 2027" />
        <Chip label="Balance" amount="€2,016.00" when="by 15 Apr 2027" />
      </div>
    </div>
  );
}

function Chip({ label, amount, when }: { label: string; amount: string; when: string }) {
  return (
    <span className="num rounded-lg bg-ink px-3 py-1.5 text-white">
      {label} <span className="font-semibold">{amount}</span> <span className="text-white/70">{when}</span>
    </span>
  );
}

const SPLIT = [
  { name: "Ana Ribeiro", note: "Skips the desert tour", riad: "232.50", desert: "–", transfers: "20.00", total: "252.50" },
  { name: "Rui Costa", note: "Wants the single room", riad: "322.50", desert: "145.00", transfers: "20.00", total: "487.50" },
  { name: "Joana Pires", note: null, riad: "232.50", desert: "145.00", transfers: "20.00", total: "397.50" },
];

export function SplitArtifact() {
  return (
    <div className={`${card} overflow-x-auto p-5`}>
      <table className="num w-full text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="pb-2 font-normal">Traveller</th>
            <th className="pb-2 text-right font-normal">Riad</th>
            <th className="pb-2 text-right font-normal">Desert</th>
            <th className="hidden pb-2 text-right font-normal sm:table-cell">Transfers</th>
            <th className="pb-2 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {SPLIT.map((r) => (
            <tr key={r.name}>
              <td className="py-2.5 pr-3">
                <span className="font-medium">{r.name}</span>
                {r.note && <span className="block text-xs text-violet">{r.note}</span>}
              </td>
              <td className="py-2.5 pl-3 text-right">{r.riad}</td>
              <td className="py-2.5 pl-3 text-right">{r.desert}</td>
              <td className="hidden py-2.5 pl-3 text-right sm:table-cell">{r.transfers}</td>
              <td className="py-2.5 pl-3 text-right font-semibold">€{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">And 9 more. The shares add up to €4,425.00 exactly.</p>
    </div>
  );
}

export function InvoiceArtifact() {
  return (
    <div className="relative pr-3 pb-3">
      <div aria-hidden className={`${card} absolute inset-0 top-3 left-3 opacity-60`} />
      <div className={`${card} relative p-5 text-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted">Invoice from Miguel Gomes for Marrakech May 2027</p>
            <p className="mt-0.5 font-medium">To Ana Ribeiro</p>
          </div>
          <span className="shrink-0 rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-medium text-teal">Paid</span>
        </div>
        <div className="num mt-4 flex items-baseline justify-between border-t border-line pt-3">
          <span>Riad Dar Zitoun 30% deposit</span>
          <span className="font-semibold">€69.75</span>
        </div>
        <p className="mt-1 text-muted">Due 19 Feb 2027, 10 days before the riad needs it. Partial payments allowed.</p>
        <p className="num mt-4 rounded-lg bg-paper px-3 py-2 text-muted">
          Next: <span className="text-ink">€182.75</span> due 5 Apr 2027 for the riad balance and transfers
        </p>
      </div>
    </div>
  );
}

export function PayoutArtifact() {
  return (
    <ol className="space-y-3 text-sm">
      <li className={`${card} flex gap-3 p-4`}>
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" />
        <div className="num">
          <p>
            Paid <span className="font-medium">Riad Dar Zitoun</span> €864.00 with PayPal Payouts
          </p>
          <p className="mt-0.5 text-muted">The pot holds €1,046.75 and the deposit is due 1 Mar 2027.</p>
        </div>
      </li>
      <li className={`${card} flex gap-3 p-4 ring-2 ring-violet`}>
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-violet" />
        <div className="num">
          <p>
            <span className="font-medium">Riad Dar Zitoun</span> balance, €2,016.00, is over your €1,500.00 limit
          </p>
          <p className="mt-0.5 text-muted">The money is set aside. It goes out when you approve it.</p>
          <span className="mt-2 inline-block rounded-md bg-violet px-2.5 py-1 text-xs font-medium text-white">
            Approve and pay
          </span>
        </div>
      </li>
    </ol>
  );
}
