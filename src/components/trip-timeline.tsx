"use client";

import "@bryntum/scheduler/scheduler.css";
import "@bryntum/scheduler/svalbard-light.css";
import "@bryntum/scheduler/fontawesome/css/fontawesome.css";
import "@bryntum/scheduler/fontawesome/css/solid.css";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import type { EventModel, Model } from "@bryntum/scheduler";
import { useMemo } from "react";
import type { TimelineData } from "@/lib/timeline";

const ROW = 40;

/**
 * Supplier deadlines and every traveller's instalments on one time axis, with the trip itself
 * shaded and a line for today. Read-only: the agent and PayPal own these dates.
 */
export default function TripTimeline({ data }: { data: TimelineData }) {
  // The dashboard refreshes every few seconds; only hand Bryntum new data when something changed.
  const key = JSON.stringify(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => data, [key]);
  const height = 56 + stable.resources.length * ROW + 2 * 36 + 8;

  return (
    <div className="trip-timeline overflow-hidden rounded-xl border border-line" style={{ height }}>
      <BryntumScheduler
        readOnly
        startDate={stable.startDate}
        endDate={stable.endDate}
        viewPreset="monthAndYear"
        forceFit
        rowHeight={ROW}
        barMargin={10}
        eventStyle="filled"
        resources={stable.resources}
        events={stable.events}
        timeRanges={[{ id: "trip", name: "Trip", startDate: stable.trip.startDate, endDate: stable.trip.endDate }]}
        columns={[
          {
            text: "Who",
            field: "name",
            width: 150,
            sortable: false,
            renderer: ({ record }: { record: Model }) => ({
              className: "tl-who",
              children: [
                { tag: "span", className: "tl-name", text: record.get("name") },
                { tag: "span", className: "tl-detail", text: record.get("detail") },
              ],
            }),
          },
        ]}
        groupFeature={{ field: "group" }}
        timeRangesFeature={{ showCurrentTimeLine: { name: "Today" }, showHeaderElements: false }}
        eventTooltipFeature={{
          template: ({ eventRecord }: { eventRecord: EventModel }) => ({
            children: (eventRecord.get("lines") as string[]).map((line, i) => ({
              tag: "div",
              className: i === 0 ? "tl-tip-title" : "tl-tip-line",
              text: line,
            })),
          }),
        }}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        cellMenuFeature={false}
        headerMenuFeature={false}
        timeAxisHeaderMenuFeature={false}
        sortFeature={false}
      />
    </div>
  );
}
