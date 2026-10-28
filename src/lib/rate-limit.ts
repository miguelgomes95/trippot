import "server-only";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, tables } from "@/db";

const { usageEvents } = tables;

// The demo is public and has no accounts, so every costly action is capped per visitor per hour
// and for everyone per day. The daily caps are what protect the Anthropic budget.
const LIMITS = {
  agent: { perHour: 20, perDay: 300, what: "questions to the agent" },
  extract: { perHour: 10, perDay: 100, what: "booking imports" },
  split: { perHour: 10, perDay: 100, what: "split plans" },
  invoices: { perHour: 5, perDay: 50, what: "invoice sends" },
  trip: { perHour: 10, perDay: 100, what: "new trips" },
} as const;

export type LimitedAction = keyof typeof LIMITS;

/**
 * The visitor's IP as the proxy reports it. A visitor can forge this header to dodge the hourly
 * limit, but not the daily cap, which counts everyone.
 */
export async function visitor() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const since = (hours: number) => sql`now() - make_interval(hours => ${hours})`;

/**
 * Records one use of `action` if it's within the limits and returns null;
 * otherwise records nothing and returns a message for the visitor.
 * Pass client "system" for automatic runs: they count towards the daily cap only.
 */
export async function takeAllowance(action: LimitedAction, client: string): Promise<string | null> {
  const limit = LIMITS[action];
  // Old rows only matter for 24 hours.
  await db.delete(usageEvents).where(lt(usageEvents.createdAt, since(48)));

  const [today] = await db
    .select({ n: count() })
    .from(usageEvents)
    .where(and(eq(usageEvents.action, action), gt(usageEvents.createdAt, since(24))));
  if (today.n >= limit.perDay) return `The demo has reached today's limit for ${limit.what}. Try again tomorrow.`;

  if (client !== "system") {
    const [hour] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(and(eq(usageEvents.action, action), eq(usageEvents.client, client), gt(usageEvents.createdAt, since(1))));
    if (hour.n >= limit.perHour)
      return `The demo allows ${limit.perHour} ${limit.what} an hour per visitor. Try again in a little while.`;
  }

  await db.insert(usageEvents).values({ action, client });
  return null;
}
