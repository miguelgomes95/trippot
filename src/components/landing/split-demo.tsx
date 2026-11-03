"use client";

import { useMemo, useState } from "react";
import { DEMO_TRAVELLERS } from "@/lib/demo-data";
import { formatMoney, splitByWeights } from "@/lib/money";

/*
 * The example trip's split, live. It follows the app's rules (src/lib/plan/split.ts and
 * instalments.ts): a booking is shared equally between the people who take part, a
 * supplement goes to whoever owes it, and each share is spread over the supplier's
 * deadlines in proportion, with every cent accounted for by splitByWeights.
 */

const PEOPLE = DEMO_TRAVELLERS.split("\n").map((line) => {
  const [name, , notes = ""] = line.split(",").map((s) => s.trim());
  return { name, notes };
});

const RIAD = 288_000;
const RIAD_MILESTONES = [86_400, 201_600]; // 30% deposit by 1 Mar, balance by 15 Apr
const SINGLE_ROOM = 9_000;
const DESERT_EACH = 14_500;
const TRANSFERS = 24_000;

function plan(desert: boolean[], single: number) {
  const n = PEOPLE.length;
  const riadBase = splitByWeights(RIAD - SINGLE_ROOM, Array(n).fill(1));
  const transfers = splitByWeights(TRANSFERS, Array(n).fill(1));
  return PEOPLE.map((p, i) => {
    const riad = riadBase[i] + (i === single ? SINGLE_ROOM : 0);
    const [deposit, balance] = splitByWeights(riad, RIAD_MILESTONES);
    const desertShare = desert[i] ? DESERT_EACH : 0;
    // Deadlines less than 21 days apart share one invoice: the riad balance, transfers and desert tour.
    const first = deposit;
    const second = balance + transfers[i] + desertShare;
    return { ...p, first, second, total: first + second };
  });
}

const money = (cents: number) => formatMoney(cents, "EUR");

export function SplitDemo() {
  const [desert, setDesert] = useState(() => PEOPLE.map((p) => !/skips the desert/i.test(p.notes)));
  const [single, setSingle] = useState(() => Math.max(0, PEOPLE.findIndex((p) => /single room/i.test(p.notes))));
  const rows = useMemo(() => plan(desert, single), [desert, single]);

  const goingToDesert = desert.filter(Boolean).length;
  const bookings = RIAD + TRANSFERS + goingToDesert * DESERT_EACH;
  const shares = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_rgba(24,32,46,0.06),0_24px_48px_-24px_rgba(24,32,46,0.3)]">
      <div className="overflow-x-auto">
        <table className="num w-full text-sm sm:min-w-[40rem]">
          <caption className="sr-only">
            Each traveller&rsquo;s two invoices for the example trip. Change who goes to the desert tour or who has the
            single room.
          </caption>
          <thead className="bg-paper/60 text-left text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-normal sm:px-5">Traveller</th>
              <th scope="col" className="px-2 py-3 text-center font-normal sm:px-3">Desert</th>
              <th scope="col" className="px-2 py-3 text-center font-normal sm:px-3">Single</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-normal sm:table-cell">Invoice due 19 Feb</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-normal sm:table-cell">Invoice due 5 Apr</th>
              <th scope="col" className="px-4 py-3 text-right font-normal sm:px-5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.name} className={desert[i] ? "" : "bg-paper/40"}>
                <th scope="row" className="px-4 py-2 text-left font-medium sm:px-5">
                  {r.name}
                </th>
                <td className="px-2 py-2 text-center sm:px-3">
                  <input
                    type="checkbox"
                    checked={desert[i]}
                    onChange={() => setDesert((d) => d.map((v, j) => (j === i ? !v : v)))}
                    aria-label={`${r.name} goes on the desert tour`}
                    className="size-4 accent-teal"
                  />
                </td>
                <td className="px-2 py-2 text-center sm:px-3">
                  <input
                    type="radio"
                    name="single-room"
                    checked={single === i}
                    onChange={() => setSingle(i)}
                    aria-label={`${r.name} has the single room`}
                    className="size-4 accent-violet"
                  />
                </td>
                <Cell value={r.first} wide />
                <Cell value={r.second} wide />
                <Cell value={r.total} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="num flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-line bg-ink px-5 py-4 text-sm text-white">
        <span>
          Bookings <span className="font-semibold">{money(bookings)}</span>
          <span className="text-white/60">
            {" "}
            (riad {money(RIAD)}, desert {goingToDesert} × {money(DESERT_EACH)}, transfers {money(TRANSFERS)})
          </span>
        </span>
        <span>
          Shares <span className="font-semibold">{money(shares)}</span>{" "}
          {shares === bookings ? (
            <span className="text-saffron">match to the cent</span>
          ) : (
            <span className="text-brick">don&rsquo;t match</span>
          )}
        </span>
      </div>
    </div>
  );
}

// `wide` columns only show from the sm breakpoint; phones see the total.
function Cell({ value, strong, wide }: { value: number; strong?: boolean; wide?: boolean }) {
  return (
    <td className={`py-2 text-right ${strong ? "px-4 font-semibold sm:px-5" : "px-3"} ${wide ? "hidden sm:table-cell" : ""}`}>
      {/* Re-keyed on change so the new amount flashes. */}
      <span key={value} className="split-flash rounded px-1">
        {money(value)}
      </span>
    </td>
  );
}
