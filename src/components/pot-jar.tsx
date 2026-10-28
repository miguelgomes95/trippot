import { formatMoney } from "@/lib/money";
import type { TripDashboard } from "@/lib/queries";

type Props = { data: TripDashboard };

const W = 180;
const H = 300;
const TOP = 26; // room for the rim

/**
 * The pot as a jar. It fills with money collected; the part already sent to suppliers
 * is hatched. Each supplier deadline is a fill line at the cumulative amount it needs:
 * once money passes a line, that supplier can be paid.
 */
export function PotJar({ data }: Props) {
  const { pot, supplierDeadlines, totalCents, trip } = data;
  const cap = Math.max(totalCents, 1);
  const y = (cents: number) => TOP + (H - TOP) * (1 - Math.min(cents, cap) / cap);

  const lines = supplierDeadlines.map((d, i) => ({
    ...d,
    at: supplierDeadlines.slice(0, i + 1).reduce((a, x) => a + x.amountCents, 0),
  }));

  // Labels sit next to their line but are pushed apart so close deadlines never overlap.
  const LABEL_GAP = 38;
  const labelTop = new Map<string, number>();
  let floor = Infinity;
  for (const l of [...lines].sort((a, b) => a.at - b.at)) {
    const top = Math.min(y(l.at), floor - LABEL_GAP);
    labelTop.set(l.id, top);
    floor = top;
  }

  const fillTop = y(pot.collectedCents);
  const paidTop = y(pot.paidOutCents);
  const money = (c: number) => formatMoney(c, trip.currency);

  return (
    <figure className="flex gap-5">
      <svg
        viewBox={`0 0 ${W} ${H + 4}`}
        width={W}
        height={H + 4}
        role="img"
        aria-label={`${money(pot.collectedCents)} collected of ${money(totalCents)}; ${money(pot.paidOutCents)} already paid to suppliers`}
        className="shrink-0"
      >
        <defs>
          <clipPath id="jar">
            <path d={`M18 ${TOP} H${W - 18} Q${W - 6} ${TOP} ${W - 6} ${TOP + 14} V${H - 18} Q${W - 6} ${H} ${W - 24} ${H} H24 Q6 ${H} 6 ${H - 18} V${TOP + 14} Q6 ${TOP} 18 ${TOP} Z`} />
          </clipPath>
          <pattern id="sent" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--color-saffron-soft)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-saffron)" strokeWidth="3" />
          </pattern>
        </defs>

        <g clipPath="url(#jar)">
          <rect x="0" y="0" width={W} height={H} fill="var(--color-surface)" />
          <rect className="pot-fill" x="0" y={fillTop} width={W} height={H - fillTop} fill="var(--color-saffron)" />
          <rect className="pot-fill" x="0" y={paidTop} width={W} height={H - paidTop} fill="url(#sent)" />
          {lines.map((l) => (
            <line
              key={l.id}
              x1="0"
              x2={W}
              y1={y(l.at)}
              y2={y(l.at)}
              stroke={l.status === "paid" ? "var(--color-teal)" : "var(--color-ink)"}
              strokeWidth="1.5"
              strokeDasharray={l.status === "paid" ? undefined : "5 4"}
            />
          ))}
        </g>
        {/* rim */}
        <rect x="12" y="8" width={W - 24} height="14" rx="5" fill="var(--color-ink)" />
        <path
          d={`M18 ${TOP} H${W - 18} Q${W - 6} ${TOP} ${W - 6} ${TOP + 14} V${H - 18} Q${W - 6} ${H} ${W - 24} ${H} H24 Q6 ${H} 6 ${H - 18} V${TOP + 14} Q6 ${TOP} 18 ${TOP} Z`}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
        />
      </svg>

      {/* Fill-line labels, positioned at the same heights as the lines. */}
      <ol className="relative min-w-0 flex-1" style={{ height: H + 4 }} aria-label="Supplier deadlines as fill lines">
        {lines.map((l) => {
          const done = l.status === "paid";
          return (
            <li
              key={l.id}
              className="absolute left-0 right-0 -translate-y-1/2 text-[13px] leading-tight"
              style={{ top: labelTop.get(l.id) }}
            >
              <span className={done ? "text-teal" : "text-ink"}>
                {done ? "Paid " : ""}
                <span className="font-medium">{l.supplier}</span> {l.label.toLowerCase()}
              </span>
              <span className="num block text-muted">{money(l.amountCents)}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
