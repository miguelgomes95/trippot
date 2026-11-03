"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useInView } from "@/components/landing/use-in-view";
import { DEMO_TRAVELLERS } from "@/lib/demo-data";
import { formatMoney } from "@/lib/money";

/*
 * The example trip told in one animation: twelve travellers pay in two rounds, the
 * pot fills past each supplier deadline and the agent pays them, until the riad
 * balance goes over the autopay limit and waits for the organizer to approve it.
 * The figures are the example trip's own (src/lib/demo-data.ts).
 */

const TOTAL = 442_500;
const DEADLINES = [
  { id: "deposit", cents: 86_400 },
  { id: "balance", cents: 201_600 },
  { id: "transfers", cents: 24_000 },
  { id: "desert", cents: 130_500 },
];

const W = 200;
const H = 300;
const TOP = 26;
const y = (cents: number) => TOP + (H - TOP) * (1 - cents / TOTAL);
const JAR = `M18 ${TOP} H${W - 18} Q${W - 6} ${TOP} ${W - 6} ${TOP + 14} V${H - 18} Q${W - 6} ${H} ${W - 24} ${H} H24 Q6 ${H} 6 ${H - 18} V${TOP + 14} Q6 ${TOP} 18 ${TOP} Z`;

// Each deadline's band in the jar, bottom to top, in due-date order.
let floor = 0;
const BANDS = DEADLINES.map((d) => {
  const band = { ...d, from: floor, to: floor + d.cents };
  floor = band.to;
  return band;
});

const INITIALS = DEMO_TRAVELLERS.split("\n").map((line) =>
  line
    .split(",")[0]
    .split(" ")
    .map((w) => w[0])
    .join(""),
);
const COIN_X = [52, 148, 84, 116, 64, 136, 100, 76, 124, 92, 140, 60];

// When each beat happens, in seconds from the start.
const T = {
  round1: 0.5,
  round2: 3.6,
  stagger: 0.13,
  deposit: 2.7,
  transfers: 5.9,
  desert: 6.4,
  ask: 7.0,
  press: 7.9,
  approved: 8.6,
  replay: 9.2,
};

// The collected amount over time, matching the `fill` keyframes in the CSS.
function collectedAt(t: number) {
  const ramp = (from: number, to: number, a: number, b: number) => a + ((b - a) * (t - from)) / (to - from);
  if (t < 0.72) return 0;
  if (t < 2.34) return ramp(0.72, 2.34, 0, 86_400);
  if (t < 3.78) return 86_400;
  if (t < 5.58) return ramp(3.78, 5.58, 86_400, TOTAL);
  return TOTAL;
}

const at = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });
const money = (cents: number) => formatMoney(cents, "EUR");

export function PotStory() {
  const [run, setRun] = useState(0);
  const [collected, setCollected] = useState(0);
  // Starts when the story scrolls into view (on phones it sits below the fold).
  const [ref, playing] = useInView<HTMLElement>();

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCollected(TOTAL);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = (now - start) / 1000;
      setCollected(Math.round(collectedAt(t) / 100) * 100);
      if (t < 6) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, run]);

  return (
    <figure key={run} ref={ref} className={`story relative ${playing ? "story-playing" : ""}`}>
      <div className="flex items-end gap-6 sm:gap-8">
        <svg
          viewBox={`0 -130 ${W} ${H + 134}`}
          className="w-[150px] shrink-0 overflow-visible sm:w-[200px]"
          role="img"
          aria-label="The pot filling as twelve travellers pay, with a fill line for each supplier deadline"
        >
          <defs>
            <clipPath id="story-jar">
              <path d={JAR} />
            </clipPath>
            <pattern id="story-sent" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--color-saffron-soft)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-saffron)" strokeWidth="3" />
            </pattern>
          </defs>

          <g aria-hidden>
            {[T.round1, T.round2].flatMap((round, r) =>
              INITIALS.map((initials, i) => (
                <g key={`${r}-${i}`} className="story-coin" style={at(round + i * T.stagger)}>
                  <circle cx={COIN_X[i]} cy={-110} r="13" fill="var(--color-saffron)" stroke="var(--color-ink)" strokeWidth="2" />
                  <text
                    x={COIN_X[i]}
                    y={-106.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--color-ink)"
                    fontFamily="var(--font-sans)"
                  >
                    {initials}
                  </text>
                </g>
              )),
            )}
          </g>

          <g clipPath="url(#story-jar)">
            <rect x="0" y="0" width={W} height={H} fill="var(--color-surface)" />
            <rect className="story-fill" x="0" y={TOP} width={W} height={H - TOP} fill="var(--color-saffron)" />
            {BANDS.map((b) => (
              <rect
                key={b.id}
                className="story-band"
                style={at(b.id === "balance" ? T.approved : T[b.id as "deposit" | "transfers" | "desert"])}
                x="0"
                y={y(b.to)}
                width={W}
                height={y(b.from) - y(b.to)}
                fill="url(#story-sent)"
              />
            ))}
            {BANDS.map((b) => (
              <line key={b.id} x1="0" x2={W} y1={y(b.to)} y2={y(b.to)} stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="5 4" />
            ))}
            <line
              className="story-band"
              style={at(T.ask)}
              x1="0"
              x2={W}
              y1={y(BANDS[1].to)}
              y2={y(BANDS[1].to)}
              stroke="var(--color-violet)"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            {BANDS.map((b) => (
              <line
                key={b.id}
                className="story-band"
                style={at(b.id === "balance" ? T.approved : T[b.id as "deposit" | "transfers" | "desert"])}
                x1="0"
                x2={W}
                y1={y(b.to)}
                y2={y(b.to)}
                stroke="var(--color-teal)"
                strokeWidth="3"
              />
            ))}
          </g>
          <rect x="12" y="8" width={W - 24} height="14" rx="5" fill="var(--color-ink)" />
          <path d={JAR} fill="none" stroke="var(--color-ink)" strokeWidth="2.5" />
        </svg>

        <div className="min-w-0 flex-1 pb-1">
          <p className="num font-display text-4xl font-bold tracking-tight sm:text-5xl" aria-hidden>
            {money(collected)}
          </p>
          <p className="text-sm text-muted">collected of {money(TOTAL)} from 12 travellers</p>

          <ol className="mt-6 space-y-3 text-sm leading-snug" aria-label="What the agent did">
            <Entry delay={T.deposit} supplier="Riad Dar Zitoun" what="deposit" cents={86_400} />
            <Entry delay={T.transfers} supplier="Marrakech Transfers" cents={24_000} />
            <Entry delay={T.desert} supplier="Atlas Desert Tours" cents={130_500} />
            <li className="grid">
              <div className="story-ask col-start-1 row-start-1 rounded-lg bg-violet-soft p-3" style={at(T.ask)} aria-hidden>
                <p>
                  <span className="font-medium">Riad Dar Zitoun</span> balance, {money(201_600)}, is over your{" "}
                  {money(150_000)} limit.
                </p>
                <span
                  className="story-press mt-2 inline-block rounded-md bg-violet px-2.5 py-1 text-xs font-medium text-white"
                  style={at(T.press)}
                >
                  Approve and pay
                </span>
              </div>
              <div className="col-start-1 row-start-1 self-start">
                <Entry delay={T.approved} supplier="Riad Dar Zitoun" what="balance" note="You approved it" cents={201_600} as="div" />
              </div>
            </li>
          </ol>
        </div>
      </div>

      <figcaption className="mt-5 flex items-baseline justify-between gap-4 text-sm text-muted">
        <span>The example trip, replayed: everyone pays in two rounds and the agent pays each supplier.</span>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="story-appear -my-1.5 -mr-2 shrink-0 rounded-md px-2 py-1.5 font-medium text-violet hover:bg-violet-soft"
          style={at(T.replay)}
        >
          Replay
        </button>
      </figcaption>
    </figure>
  );
}

function Entry({
  delay,
  supplier,
  what,
  note,
  cents,
  as: Tag = "li",
}: {
  delay: number;
  supplier: string;
  what?: string;
  note?: string;
  cents: number;
  as?: "li" | "div";
}) {
  return (
    <Tag className="story-appear flex items-baseline gap-2.5" style={at(delay)}>
      <span aria-hidden className="size-2 shrink-0 translate-y-[-1px] rounded-full bg-teal" />
      <span className="min-w-0 flex-1">
        Paid <span className="font-medium">{supplier}</span>
        {what ? ` ${what}` : ""}
        {note && <span className="block text-muted">{note}</span>}
      </span>
      <span className="num shrink-0 text-muted">{money(cents)}</span>
    </Tag>
  );
}
