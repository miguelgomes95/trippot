import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { listTrips } from "@/lib/queries";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:px-10">
      <h1 className="font-display text-5xl font-bold tracking-tight">TripPot</h1>
      <p className="mt-3 max-w-prose text-lg text-muted">
        The money side of a group trip, run by an agent: it collects from every traveller with PayPal invoices, chases
        late payers, and pays each supplier as soon as the pot covers it.
      </p>
      <Link href="/trips/new" className="mt-8 inline-block rounded-lg bg-ink px-5 py-2.5 font-medium text-white">
        Plan a trip
      </Link>
      <h2 className="mt-12 mb-3 font-display text-xl font-semibold">Your trips</h2>
      <Suspense fallback={<p className="text-muted">Loading trips…</p>}>
        <Trips />
      </Suspense>
    </main>
  );
}

async function Trips() {
  await connection();
  const trips = await listTrips();
  if (!trips.length)
    return <p className="text-muted">No trips yet. Plan one, or start from the example trip on the next page.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {trips.map((t) => (
        <li key={t.id}>
          <Link href={`/trips/${t.id}`} className="flex items-baseline justify-between py-3 hover:text-violet">
            <span className="font-medium">{t.name}</span>
            <span className="text-sm text-muted">{t.destination}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
