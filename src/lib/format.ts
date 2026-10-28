// Date formatting for the UI. Dates are ISO days ("2027-05-14") and always read as UTC.

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "1 Mar" */
export const day = (iso: string) =>
  utc(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "14 to 18 May 2027", or "28 April to 3 May 2027" across months. */
export function dateRange(start: string, end: string) {
  const [a, b] = [utc(start), utc(end)];
  const opts = { timeZone: "UTC" } as const;
  const last = b.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "long", year: "numeric" });
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()
    ? `${a.getUTCDate()} to ${last}`
    : `${a.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "long" })} to ${last}`;
}
