import Link from "next/link";
import { NewTripForm } from "@/components/new-trip-form";

export const metadata = { title: "Plan a trip · TripPot" };

export default function NewTripPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        TripPot
      </Link>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Plan a trip</h1>
      <p className="mt-3 mb-10 max-w-prose text-lg text-muted">
        Add the trip and who&rsquo;s coming. Then paste the booking confirmations and TripPot works out who pays what.
      </p>
      <NewTripForm />
    </main>
  );
}
