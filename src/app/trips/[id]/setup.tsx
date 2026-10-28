import Link from "next/link";
import type { ReactNode } from "react";
import { ImportBookings, RemoveBooking, StepAction, SupplierEmail } from "@/components/setup-controls";
import { dateRange, day } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PAY_BUFFER_DAYS } from "@/lib/plan/instalments";
import type { TripSetup } from "@/lib/queries";
import { planTripSplit, sendTripInvoices } from "./setup-actions";

type Props = { data: TripSetup };

/** The three steps between creating a trip and its invoices going out. */
export function Setup({ data }: Props) {
  const { trip, travellers, bookings, instalments } = data;
  const money = (cents: number) => formatMoney(cents, trip.currency);
  const planned = instalments.total > 0;
  const split = bookings.length > 0 && bookings.every((b) => b.shares.length > 0);
  const stale = !split && bookings.some((b) => b.shares.length > 0);
  const unpayable = bookings.filter((b) => !b.supplierPaypalEmail);
  const total = bookings.reduce((a, b) => a + b.totalCents, 0);

  return (
    <main className="mx-auto max-w-3xl space-y-12 px-5 py-10 sm:px-10">
      <header>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          TripPot
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{trip.name}</h1>
        <p className="mt-2 text-muted">
          {trip.destination}, {dateRange(trip.startDate, trip.endDate)}. Organized by {trip.organizerName}.
        </p>
        <p className="mt-4 text-sm">
          <span className="font-medium">{travellers.length} travellers: </span>
          {travellers.map((t, i) => (
            <span key={t.id}>
              {t.name}
              {t.notes && <span className="text-muted"> ({t.notes.toLowerCase()})</span>}
              {i < travellers.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </header>

      <Step n={1} title="Add the bookings" done={bookings.length > 0}>
        <p className="text-muted">
          Paste the confirmation emails from the hotel, tours and transport. TripPot reads each price, the payment deadlines
          and where to pay.
        </p>
        {bookings.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {bookings.map((b) => (
              <li key={b.id} className="space-y-2 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p>
                    <span className="font-medium">{b.supplierName}</span>{" "}
                    <span className="text-sm text-muted">
                      {b.category}
                      {b.startsOn && `, ${b.endsOn && b.endsOn !== b.startsOn ? dateRange(b.startsOn, b.endsOn) : day(b.startsOn)}`}
                    </span>
                  </p>
                  <span className="num font-medium">{money(b.totalCents)}</span>
                </div>
                <ul className="text-sm">
                  {b.milestones.map((m) => (
                    <li key={m.id} className="flex justify-between gap-4 text-muted">
                      <span>
                        {m.label}, by {day(m.dueDate)}
                      </span>
                      <span className="num">{money(m.amountCents)}</span>
                    </li>
                  ))}
                </ul>
                {b.notes.length > 0 && <p className="text-sm text-muted">Notes for the split: {b.notes.join("; ")}</p>}
                <SupplierEmail tripId={trip.id} bookingId={b.id} email={b.supplierPaypalEmail} />
                {!planned && <RemoveBooking tripId={trip.id} bookingId={b.id} supplier={b.supplierName} />}
              </li>
            ))}
            <li className="flex justify-between py-3 font-medium">
              <span>Total</span>
              <span className="num">{money(total)}</span>
            </li>
          </ul>
        )}
        {!planned && <ImportBookings tripId={trip.id} first={bookings.length === 0} />}
      </Step>

      <Step n={2} title="Split the costs" done={split} locked={!bookings.length}>
        <p className="text-muted">
          The agent decides who takes part in each booking and who owes a supplement, from your notes on each traveller.
          The arithmetic is done in code, so the shares always add up to each booking&rsquo;s total.
        </p>
        {stale && <p className="text-sm text-brick">The bookings changed after the split. Plan it again.</p>}
        {split && <SplitTable data={data} />}
        {bookings.length > 0 && !planned && (
          <StepAction
            run={planTripSplit.bind(null, trip.id)}
            label={split ? "Plan the split again" : "Plan the split"}
            pendingLabel="The agent is planning the split…"
          />
        )}
      </Step>

      <Step n={3} title="Send the invoices" done={false} locked={!split}>
        <p className="text-muted">
          Each traveller gets a PayPal invoice for each payment date, due {PAY_BUFFER_DAYS} days before the supplier deadline
          it covers. They can pay in parts. After that, the agent takes over: it chases late payers and pays each supplier
          once the pot covers it.
        </p>
        {unpayable.length > 0 && split && (
          <p className="text-sm text-brick">
            The agent can&rsquo;t pay {unpayable.map((b) => b.supplierName).join(" or ")} until you add a PayPal email above.
          </p>
        )}
        {planned && instalments.unsent > 0 && (
          <p className="text-sm text-brick">
            {instalments.unsent} of {instalments.total} invoices haven&rsquo;t gone out yet.
          </p>
        )}
        {split && (
          <StepAction
            run={sendTripInvoices.bind(null, trip.id)}
            label={planned ? `Send the remaining ${instalments.unsent} invoices` : `Send invoices for ${money(total)} with PayPal`}
            pendingLabel="Sending the invoices…"
          />
        )}
      </Step>
    </main>
  );
}

function Step({
  n,
  title,
  done,
  locked = false,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${n}`} className={`grid grid-cols-[36px_1fr] gap-x-4 ${locked ? "opacity-50" : ""}`}>
      <span
        className={`num flex h-9 w-9 items-center justify-center rounded-full font-display font-semibold ${
          done ? "bg-teal text-white" : "border-2 border-ink"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 space-y-4">
        <h2 id={`step-${n}`} className="pt-1 font-display text-2xl font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {children}
      </div>
    </section>
  );
}

function SplitTable({ data }: Props) {
  const { trip, travellers, bookings } = data;
  const money = (cents: number) => formatMoney(cents, trip.currency);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-3 font-medium">Traveller</th>
              {bookings.map((b) => (
                <th key={b.id} className="px-3 py-2 text-right font-medium">
                  {b.supplierName}
                </th>
              ))}
              <th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {travellers.map((t) => {
              const mine = bookings.map((b) => b.shares.find((s) => s.travellerId === t.id));
              return (
                <tr key={t.id}>
                  <td className="whitespace-nowrap py-2 pr-3 align-top">{t.name}</td>
                  {mine.map((s, i) => (
                    <td key={bookings[i].id} className="num px-3 py-2 text-right align-top">
                      {s ? money(s.amountCents) : <span className="text-muted">not going</span>}
                      {s?.reason && <span className="ml-auto block max-w-48 text-xs text-muted">{s.reason}</span>}
                    </td>
                  ))}
                  <td className="num py-2 pl-3 text-right align-top font-medium">
                    {money(mine.reduce((a, s) => a + (s?.amountCents ?? 0), 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-sm text-muted">
        {bookings
          .filter((b) => b.explanation)
          .map((b) => (
            <li key={b.id}>
              <span className="font-medium text-ink">{b.supplierName}:</span> {b.explanation}
            </li>
          ))}
      </ul>
    </div>
  );
}
