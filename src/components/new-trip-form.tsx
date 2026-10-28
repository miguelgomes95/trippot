"use client";

import { useActionState, useRef } from "react";
import { createTrip, type NewTripState, type NewTripValues } from "@/app/trips/new/actions";
import { DEMO_TRAVELLERS, DEMO_TRIP } from "@/lib/demo-data";

const EMPTY: NewTripValues = {
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
  currency: "EUR",
  organizerName: "",
  organizerEmail: "",
  autopayLimit: "1000",
  travellers: "",
};

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-ink";
const label = "mb-1 block text-sm font-medium";
const help = "mt-1 text-sm text-muted";

export function NewTripForm() {
  const [state, action, pending] = useActionState<NewTripState, FormData>(createTrip, null);
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed submit React resets the form to these defaults, so the typed values come back.
  const values = state?.values ?? EMPTY;

  function fillExample() {
    const example: NewTripValues = { ...DEMO_TRIP, travellers: DEMO_TRAVELLERS };
    for (const [name, value] of Object.entries(example)) {
      const field = formRef.current?.elements.namedItem(name);
      if (field && "value" in field) field.value = value;
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-3">
        <p className="text-sm text-muted">Trying TripPot? Start from a 12-person trip to Marrakech.</p>
        <button
          type="button"
          onClick={fillExample}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-ink"
        >
          Use the example trip
        </button>
      </div>

      {state?.errors.length ? (
        <div role="alert" className="rounded-xl bg-brick-soft px-4 py-3 text-sm text-brick">
          <p className="font-medium">Fix these to create the trip:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-xl font-semibold">The trip</legend>
        <div>
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" name="name" defaultValue={values.name} placeholder="Lisbon stag weekend" className={input} required />
        </div>
        <div>
          <label htmlFor="destination" className={label}>Where</label>
          <input id="destination" name="destination" defaultValue={values.destination} placeholder="Lisbon, Portugal" className={input} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
          <div>
            <label htmlFor="startDate" className={label}>First day</label>
            <input id="startDate" name="startDate" type="date" defaultValue={values.startDate} className={input} required />
          </div>
          <div>
            <label htmlFor="endDate" className={label}>Last day</label>
            <input id="endDate" name="endDate" type="date" defaultValue={values.endDate} className={input} required />
          </div>
          <div>
            <label htmlFor="currency" className={label}>Currency</label>
            <select id="currency" name="currency" defaultValue={values.currency} className={input}>
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-xl font-semibold">You, the organizer</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="organizerName" className={label}>Your name</label>
            <input id="organizerName" name="organizerName" defaultValue={values.organizerName} className={input} required />
            <p className={help}>Travellers see it on their invoices.</p>
          </div>
          <div>
            <label htmlFor="organizerEmail" className={label}>Your email</label>
            <input id="organizerEmail" name="organizerEmail" type="email" defaultValue={values.organizerEmail} className={input} required />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-xl font-semibold">Who&rsquo;s coming</legend>
        <label htmlFor="travellers" className={label}>Travellers, one per line</label>
        <textarea
          id="travellers"
          name="travellers"
          defaultValue={values.travellers}
          rows={8}
          placeholder={"Ana Ribeiro, ana@example.com, skips the boat trip\nRui Costa, rui@example.com, wants a single room"}
          className={`${input} font-[inherit] leading-relaxed`}
          required
        />
        <p className={help}>
          Name, email, then anything the agent should know when it splits the costs. Include yourself if you&rsquo;re paying a share.
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-xl font-semibold">Paying suppliers</legend>
        <label htmlFor="autopayLimit" className={label}>The agent pays a supplier on its own up to</label>
        <input id="autopayLimit" name="autopayLimit" type="number" min="0" step="1" defaultValue={values.autopayLimit} className={`${input} num max-w-xs`} required />
        <p className={help}>In the trip&rsquo;s currency. Above this amount it asks you first.</p>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-lg bg-ink px-5 py-2.5 font-medium text-white disabled:opacity-50">
          {pending ? "Creating the trip…" : "Create trip"}
        </button>
        <p className="text-sm text-muted">Next you&rsquo;ll paste the booking confirmations.</p>
      </div>
    </form>
  );
}
