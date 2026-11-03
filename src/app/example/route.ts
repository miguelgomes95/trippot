import { redirect } from "next/navigation";
import { connection } from "next/server";
import { exampleTrip } from "@/lib/queries";

// A stable link to the seeded example trip, so the home page hero can stay static.
export async function GET() {
  await connection();
  const trip = await exampleTrip();
  redirect(trip ? `/trips/${trip.id}` : "/trips/new");
}
