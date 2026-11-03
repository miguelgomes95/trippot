import "server-only";
import { cookies } from "next/headers";

// The demo has no accounts, so the home page lists only the trips this browser created.
const COOKIE = "trippot_trips";
const MAX = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function myTripIds(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  return raw.split(".").filter((id) => UUID.test(id));
}

/** Call from a Server Function only: cookies can't be set while rendering. */
export async function rememberTrip(tripId: string) {
  const ids = [tripId, ...(await myTripIds()).filter((id) => id !== tripId)].slice(0, MAX);
  (await cookies()).set(COOKIE, ids.join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  });
}
