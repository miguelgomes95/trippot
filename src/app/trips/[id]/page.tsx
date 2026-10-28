import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AgentChat } from "@/components/agent-chat";
import { AutoRefresh } from "@/components/auto-refresh";
import { ApproveButton, SimulatePaymentButton } from "@/components/demo-buttons";
import { PotJar } from "@/components/pot-jar";
import { formatMoney } from "@/lib/money";
import { tripDashboard, type TripDashboard } from "@/lib/queries";

export default function TripPage({ params }: PageProps<"/trips/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">Opening the pot…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const data = await tripDashboard(id).catch(() => null);
  if (!data) notFound();
  const { trip } = data;

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_380px]">
      <AutoRefresh />
      <main className="mx-auto w-full max-w-4xl space-y-14 px-5 py-10 sm:px-10">
        <Header data={data} />
        <Deadlines data={data} />
        <Travellers data={data} />
        <Activity data={data} />
      </main>
      <aside className="border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:border-l">
        <AgentChat tripId={trip.id} tripName={trip.name} />
      </aside>
    </div>
  );
}

const money = (cents: number, currency: string) => formatMoney(cents, currency);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function range(dates: string) {
  const [a, b] = dates.split(" → ").map((d) => new Date(`${d}T00:00:00Z`));
  const opts = { timeZone: "UTC" } as const;
  const end = b.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "long", year: "numeric" });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} to ${end}`
    : `${a.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "long" })} to ${end}`;
}

function Header({ data }: { data: TripDashboard }) {
  const { trip, pot, totalCents, supplierDeadlines, travellers } = data;
  const next = supplierDeadlines.find((d) => d.status !== "paid");
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-muted">TripPot</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{trip.name}</h1>
        <p className="mt-2 text-muted">
          {trip.destination}, {range(trip.dates)}. {travellers.length} travellers.
        </p>
      </div>

      <div className="flex flex-col gap-10 sm:flex-row sm:items-start">
        <div className="sm:w-[440px]">
          <PotJar data={data} />
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-5 self-center sm:grid-cols-1">
          <div>
            <dt className="text-sm text-muted">In the pot now</dt>
            <dd className="num font-display text-4xl font-bold text-ink">{money(pot.balanceCents, trip.currency)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Collected</dt>
            <dd className="num text-lg">
              {money(pot.collectedCents, trip.currency)}{" "}
              <span className="text-muted">of {money(totalCents, trip.currency)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Paid to suppliers</dt>
            <dd className="num text-lg">{money(pot.paidOutCents, trip.currency)}</dd>
          </div>
          {next && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm text-muted">Next supplier deadline</dt>
              <dd className="text-lg">
                {next.supplier} {next.label.toLowerCase()}, <span className="num">{money(next.amountCents, trip.currency)}</span> by{" "}
                {day(next.dueDate)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

const MILESTONE: Record<string, { text: string; className: string }> = {
  pending: { text: "Collecting", className: "bg-paper text-muted" },
  funded: { text: "Ready to pay", className: "bg-saffron-soft text-ink" },
  awaiting_approval: { text: "Needs your approval", className: "bg-violet-soft text-violet" },
  paid: { text: "Paid", className: "bg-teal-soft text-teal" },
  failed: { text: "Payment failed", className: "bg-brick-soft text-brick" },
};

function Deadlines({ data }: { data: TripDashboard }) {
  const { trip, supplierDeadlines } = data;
  return (
    <section aria-labelledby="deadlines">
      <h2 id="deadlines" className="font-display text-2xl font-semibold">
        Supplier deadlines
      </h2>
      <p className="mb-4 text-sm text-muted">
        Paid from the pot in date order. Up to {money(trip.autopay.limitCents, trip.currency)} the agent pays on its own; above
        that it asks you.
      </p>
      <ol className="divide-y divide-line border-y border-line">
        {supplierDeadlines.map((d) => {
          const s = MILESTONE[d.status];
          return (
            <li key={d.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-4 py-3">
              <span className="num text-sm text-muted">{day(d.dueDate)}</span>
              <span>
                <span className="font-medium">{d.supplier}</span> <span className="text-muted">{d.label.toLowerCase()}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="num">{money(d.amountCents, trip.currency)}</span>
                {d.status === "awaiting_approval" ? (
                  <ApproveButton tripId={trip.id} milestoneId={d.id} />
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.text}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Travellers({ data }: { data: TripDashboard }) {
  const { trip, travellers } = data;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section aria-labelledby="travellers">
      <h2 id="travellers" className="mb-4 font-display text-2xl font-semibold">
        Travellers
      </h2>
      <ul className="divide-y divide-line border-y border-line">
        {travellers.map((t) => {
          const next = t.instalments.find((i) => i.status !== "paid" && i.status !== "cancelled");
          const late = next && next.dueDate < today;
          const pct = t.owedCents ? Math.round((t.paidCents / t.owedCents) * 100) : 0;
          return (
            <li key={t.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-5">
              <span>
                <span className="font-medium">{t.name}</span>
                {t.notes && <span className="block text-xs text-muted">{t.notes}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-saffron" style={{ width: `${pct}%` }} />
                </span>
                <span className="num w-40 text-right text-sm">
                  {money(t.paidCents, trip.currency)} <span className="text-muted">of {money(t.owedCents, trip.currency)}</span>
                </span>
              </span>
              <span className="flex items-center justify-end gap-3 text-sm">
                {next ? (
                  <>
                    <span className={late ? "text-brick" : "text-muted"}>
                      {late ? "Late since" : "Next"} {day(next.dueDate)}
                    </span>
                    <SimulatePaymentButton tripId={trip.id} instalmentId={next.id} />
                  </>
                ) : (
                  <span className="text-teal">Fully paid</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        &ldquo;Pay as traveller&rdquo; pays the invoice in the PayPal sandbox, so you can watch the pot fill during the demo.
      </p>
    </section>
  );
}

const KIND: Record<string, { label: string; dot: string }> = {
  extract: { label: "Read a booking", dot: "bg-muted" },
  plan: { label: "Planned", dot: "bg-muted" },
  invoice_sent: { label: "Invoices", dot: "bg-ink" },
  payment_received: { label: "Payment in", dot: "bg-saffron" },
  reminder_sent: { label: "Reminder", dot: "bg-violet" },
  payout_sent: { label: "Paid supplier", dot: "bg-teal" },
  payout_blocked: { label: "Held back", dot: "bg-brick" },
  payout_failed: { label: "Payout failed", dot: "bg-brick" },
  approval_needed: { label: "Needs approval", dot: "bg-violet" },
  answer: { label: "Agent", dot: "bg-ink" },
};

function Activity({ data }: { data: TripDashboard }) {
  return (
    <section aria-labelledby="activity">
      <h2 id="activity" className="font-display text-2xl font-semibold">
        What the agent did
      </h2>
      <p className="mb-4 text-sm text-muted">Every action, with its reason. Newest first.</p>
      <ol className="space-y-4">
        {data.activity.map((a) => {
          const k = KIND[a.kind] ?? { label: a.kind, dot: "bg-muted" };
          return (
            <li key={a.id} className="grid grid-cols-[12px_1fr] gap-3">
              <span className={`mt-2 h-2 w-2 rounded-full ${k.dot}`} aria-hidden />
              <div>
                <p className="text-sm">
                  <span className="font-medium">{a.summary}</span>
                </p>
                {a.reason && <p className="text-sm text-muted">{a.reason}</p>}
                <p className="text-xs text-muted">
                  {k.label}, {a.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
