// Turns the dashboard data into rows and events for the timeline (Bryntum Scheduler).
// Kept as plain data so the server can build it and the client only renders it.
import { day } from "./format";
import { formatMoney } from "./money";
import type { TripDashboard } from "./queries";

export type TimelineResource = { id: string; name: string; group: string; detail: string };
export type TimelineEvent = {
  id: string;
  resourceId: string;
  name: string;
  startDate: string;
  endDate: string;
  eventColor: string;
  // Shown in the tooltip, one line each.
  lines: string[];
};
export type TimelineData = {
  startDate: string;
  endDate: string;
  trip: { startDate: string; endDate: string };
  resources: TimelineResource[];
  events: TimelineEvent[];
};

// The same colours as the rest of the app (globals.css).
const COLOR = {
  ink: "#18202e",
  muted: "#8a93a3",
  saffron: "#e2a23b",
  teal: "#17766b",
  brick: "#b3473b",
  violet: "#5f55c9",
};

const MILESTONE: Record<string, { text: string; color: string }> = {
  pending: { text: "Collecting", color: COLOR.muted },
  funded: { text: "Ready to pay", color: COLOR.saffron },
  awaiting_approval: { text: "Needs your approval", color: COLOR.violet },
  paid: { text: "Paid", color: COLOR.teal },
  failed: { text: "Payment failed", color: COLOR.brick },
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function timelineData(data: TripDashboard, today = new Date().toISOString().slice(0, 10)): TimelineData {
  const { trip, bookings, supplierDeadlines, travellers } = data;
  const money = (cents: number) => formatMoney(cents, trip.currency);
  const [tripStart, tripEnd] = trip.dates.split(" → ");

  const resources: TimelineResource[] = [
    ...bookings.map((b) => ({ id: `b-${b.id}`, name: b.supplierName, group: "Suppliers", detail: money(b.totalCents) })),
    ...travellers.map((t) => ({ id: `t-${t.id}`, name: t.name, group: "Travellers", detail: money(t.owedCents) })),
  ];

  const events: TimelineEvent[] = [];
  for (const d of supplierDeadlines) {
    const s = MILESTONE[d.status];
    events.push({
      id: `m-${d.id}`,
      resourceId: `b-${d.bookingId}`,
      name: money(d.amountCents),
      startDate: d.dueDate,
      endDate: d.dueDate,
      eventColor: s.color,
      lines: [`${d.supplier}, ${d.label.toLowerCase()}`, `${money(d.amountCents)} due ${day(d.dueDate)}`, s.text],
    });
  }
  for (const t of travellers) {
    for (const i of t.instalments) {
      if (i.status === "cancelled") continue;
      const late = i.status !== "paid" && i.dueDate < today;
      const [color, state] =
        i.status === "paid"
          ? [COLOR.teal, "Paid"]
          : late
            ? [COLOR.brick, `Late, ${money(i.amountCents - i.paidCents)} still to pay`]
            : i.paidCents > 0
              ? [COLOR.saffron, `${money(i.paidCents)} paid so far`]
              : [COLOR.ink, "Invoice sent, not paid yet"];
      events.push({
        id: `i-${i.id}`,
        resourceId: `t-${t.id}`,
        name: money(i.amountCents),
        startDate: i.dueDate,
        endDate: i.dueDate,
        eventColor: color,
        lines: [t.name, i.label, `${money(i.amountCents)} due ${day(i.dueDate)}`, state],
      });
    }
  }

  // From a little before the first date to a little after the trip.
  const dates = [today, ...events.map((e) => e.startDate)].sort();
  return {
    startDate: addDays(dates[0], -14),
    endDate: addDays(tripEnd, 31),
    trip: { startDate: tripStart, endDate: addDays(tripEnd, 1) },
    resources,
    events,
  };
}
