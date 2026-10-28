"use client";

import { useState, useTransition } from "react";
import { importBookings, removeBooking, setSupplierEmail, type StepResult } from "@/app/trips/[id]/setup-actions";
import { DEMO_CONFIRMATIONS } from "@/lib/demo-data";

function Messages({ result }: { result: StepResult | null }) {
  if (!result?.messages.length) return null;
  return (
    <ul
      role={result.ok ? "status" : "alert"}
      className={`space-y-1 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-saffron-soft text-ink" : "bg-brick-soft text-brick"}`}
    >
      {result.messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

export function ImportBookings({ tripId, first }: { tripId: string; first: boolean }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StepResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await importBookings(tripId, text);
          setResult(res);
          if (res.ok) setText("");
        });
      }}
    >
      <label htmlFor="confirmations" className="block text-sm font-medium">
        {first ? "Booking confirmations" : "Add more confirmations"}
      </label>
      <textarea
        id="confirmations"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={first ? 10 : 4}
        placeholder="Paste the confirmation emails here, as many as you like."
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink"
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Reading the confirmations…" : "Read confirmations"}
        </button>
        {first && (
          <button
            type="button"
            onClick={() => setText(DEMO_CONFIRMATIONS)}
            disabled={pending}
            className="text-sm font-medium text-violet hover:underline"
          >
            Paste the example confirmations
          </button>
        )}
      </div>
      <Messages result={result} />
    </form>
  );
}

export function SupplierEmail({ tripId, bookingId, email }: { tripId: string; bookingId: string; email: string | null }) {
  const [editing, setEditing] = useState(!email);
  const [value, setValue] = useState(email ?? "");
  const [result, setResult] = useState<StepResult | null>(null);
  const [pending, start] = useTransition();

  if (!editing && email)
    return (
      <p className="text-sm">
        <span className="text-muted">Paid by PayPal to</span> {email}{" "}
        <button onClick={() => setEditing(true)} className="text-violet hover:underline">
          Change
        </button>
      </p>
    );

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setSupplierEmail(tripId, bookingId, value);
          setResult(res);
          if (res.ok) setEditing(false);
        });
      }}
    >
      <label htmlFor={`email-${bookingId}`} className={`block text-sm ${email ? "" : "text-brick"}`}>
        {email ? "Supplier's PayPal email" : "Add the supplier's PayPal email so the agent can pay it"}
      </label>
      <div className="flex max-w-md gap-2">
        <input
          id={`email-${bookingId}`}
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink"
          disabled={pending}
        />
        <button type="submit" disabled={pending || !value.trim()} className="rounded-lg border border-ink px-3 text-sm font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <Messages result={result} />
    </form>
  );
}

export function RemoveBooking({ tripId, bookingId, supplier }: { tripId: string; bookingId: string; supplier: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => void (await removeBooking(tripId, bookingId)))}
      disabled={pending}
      className="text-sm text-brick hover:underline disabled:opacity-50"
      aria-label={`Remove ${supplier}`}
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

/** A step's main button: runs the action, shows progress while it works and any messages after. */
export function StepAction({
  run,
  label,
  pendingLabel,
  disabled,
}: {
  run: () => Promise<StepResult>;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<StepResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button
        onClick={() => start(async () => setResult(await run()))}
        disabled={pending || disabled}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? pendingLabel : label}
      </button>
      <Messages result={result} />
    </div>
  );
}
