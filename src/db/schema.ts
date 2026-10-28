import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money is stored as integer cents in the trip's currency.

export const bookingCategory = pgEnum("booking_category", [
  "flight",
  "lodging",
  "activity",
  "transport",
  "other",
]);

export const milestoneStatus = pgEnum("milestone_status", [
  "pending", // not enough money in the pot yet
  "funded", // pot covers it, waiting for the agent (or the organizer) to pay
  "awaiting_approval", // above the auto-pay limit, organizer must approve
  "paid",
  "failed",
]);

export const instalmentStatus = pgEnum("instalment_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "cancelled",
]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  currency: text("currency").notNull().default("EUR"),
  organizerName: text("organizer_name").notNull(),
  organizerEmail: text("organizer_email").notNull(),
  // Guardrails for the agent paying suppliers on its own.
  autopayEnabled: boolean("autopay_enabled").notNull().default(true),
  autopayLimitCents: integer("autopay_limit_cents").notNull().default(100_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const travellers = pgTable("travellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  // Free text the organizer gives the agent, e.g. "single room", "skips the desert tour".
  notes: text("notes"),
});

// A supplier booking extracted from a confirmation (flight, riad, tour...).
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  supplierName: text("supplier_name").notNull(),
  category: bookingCategory("category").notNull(),
  totalCents: integer("total_cents").notNull(),
  // Where Payouts sends the money.
  supplierPaypalEmail: text("supplier_paypal_email"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  cancellationPolicy: text("cancellation_policy"),
  // Who-pays-what hints from the confirmation, e.g. "9 participants", "single room +90 EUR".
  notes: text("notes").array().notNull().default([]),
  sourceText: text("source_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// What a booking requires and when: e.g. 30% deposit by Mar 1, balance by Apr 15.
export const supplierMilestones = pgTable("supplier_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  status: milestoneStatus("status").notNull().default("pending"),
  payoutBatchId: text("payout_batch_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

// How much of each booking a traveller owes (output of the split plan).
export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    travellerId: uuid("traveller_id")
      .notNull()
      .references(() => travellers.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("shares_booking_traveller").on(t.bookingId, t.travellerId)],
);

// What a traveller is asked to pay and when; each one is a PayPal invoice.
export const instalments = pgTable("instalments", {
  id: uuid("id").primaryKey().defaultRandom(),
  travellerId: uuid("traveller_id")
    .notNull()
    .references(() => travellers.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  dueDate: date("due_date").notNull(),
  status: instalmentStatus("status").notNull().default("draft"),
  paypalInvoiceId: text("paypal_invoice_id").unique(),
  paypalPayerUrl: text("paypal_payer_url"),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  instalmentId: uuid("instalment_id")
    .notNull()
    .references(() => instalments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  paypalTransactionId: text("paypal_transaction_id").unique(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// Audit log: every action the agent takes, with its reasoning, is shown to the organizer.
export const agentActions = pgTable("agent_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // extract | plan | invoice_sent | reminder_sent | payout_sent | payout_blocked | answer
  summary: text("summary").notNull(),
  reason: text("reason"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// PayPal webhook deliveries, keyed by event id so retries are processed once.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
