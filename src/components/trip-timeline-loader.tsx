"use client";

import dynamic from "next/dynamic";
import type { TimelineData } from "@/lib/timeline";

// Bryntum needs the browser (window, layout measurements), so it never renders on the server.
const TripTimeline = dynamic(() => import("./trip-timeline"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" aria-label="Loading the timeline" />,
});

export function TripTimelineLoader({ data }: { data: TimelineData }) {
  return <TripTimeline data={data} />;
}
