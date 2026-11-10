# TripPot

**An AI agent that runs the money side of a group trip.** It reads the booking confirmations, works out who owes what, collects from every traveller with PayPal invoices, reminds the people who are late, and pays each supplier through PayPal Payouts as soon as the group's pot covers it.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) (2026).

- **Live demo:** https://trippot.onrender.com (PayPal sandbox)
- **Video:** https://youtu.be/XZWa_kEoFl8

## The problem

Whoever organizes a group trip ends up acting as its bank. They pay the riad deposit on their own card, work out a fair split when three people skip the desert tour and one wants the single room, and then spend weeks chasing twelve friends for money before each supplier deadline.

TripPot takes that job. The organizer pastes the confirmations and approves big payments. The agent does the rest.

## How it works

1. **Read the bookings.** The organizer pastes the confirmation emails. Claude extracts each supplier, its total, its payment schedule (a 30% deposit by 1 March, the balance by 15 April) and where to pay it.
2. **Split the costs.** The agent decides who takes part in each booking and who owes a supplement, using the organizer's notes on each traveller ("skips the desert tour", "wants the single room"). The arithmetic is done in code, so each booking's shares always add up to its total, to the cent.
3. **Collect.** Every traveller gets a PayPal invoice for each payment date, due 10 days before the supplier deadline it covers. Invoices accept partial payments. Deadlines close together are merged into one invoice.
4. **Pay suppliers.** PayPal webhooks report each payment. As soon as the pot covers a supplier deadline, the agent pays it with PayPal Payouts and writes down why. Above the organizer's limit, it asks for approval first.
5. **Ask it anything.** "Who still owes money for the riad?" "Remind everyone who is late." The agent answers from live data and acts.

The dashboard shows the pot as a jar that fills as payments arrive, a timeline of every payment in and out (Bryntum Scheduler), and a log of everything the agent did and why.

## Guardrails live in code, not in the prompt

The agent can move money, so the rules that keep it safe are enforced by the code it calls, whatever the model says:

- A supplier is paid only when the pot covers that deadline and every earlier one (`src/lib/pot.ts`).
- Payments above the organizer's autopay limit wait for approval.
- Each supplier deadline can be paid once: the Payouts batch id is derived from the deadline, so PayPal rejects a duplicate.
- Reminders go out at most once per instalment every 24 hours.
- If PayPal refuses a payout, the money stays set aside for that supplier and the refusal is logged.
- Every action is recorded with its reason in the agent's log.

## Where AI is used

| Step | Model | Why |
|---|---|---|
| Reading confirmations | Claude Haiku 5.5, structured output | Fast and cheap; free-form emails become typed bookings and deadlines |
| Planning the split | Claude Opus 5.5, structured output | Judgment on who takes part and who owes a supplement; it also flags inconsistent bookings |
| The agent (chat and automatic payments) | Claude Opus 5.5, tool use | Reads the trip, sends reminders, pays suppliers |

The model makes judgment calls only. Amounts, due dates and pot balances are computed in code.

## PayPal APIs

- **Invoicing v2:** create, send and remind, with partial payments allowed. The organizer and trip name appear as the sender.
- **Payouts:** pays suppliers from the pot, idempotently.
- **Webhooks:** `INVOICING.INVOICE.*` and `PAYMENT.PAYOUTS*`, with signature verification and deduplication.
- **OAuth 2.0** client credentials, with the token cached and `PayPal-Request-Id` set on every write.

## Try it

On the live demo:

1. Open **Marrakech May 2027**, a 12-person trip that's already set up.
2. Press **Pay as traveller** on a few rows. Each one pays that traveller's invoice in the PayPal sandbox, and you can watch the pot fill.
3. When a supplier deadline is covered, the agent pays it on its own. The riad balance is above the autopay limit, so it waits for **Approve and pay**.
4. Ask the agent something in the chat.

To start from scratch, choose **Plan your own** on the home page and then **Use the example trip**. The home page lists only the trips created in your browser.

The demo is public, so it limits each visitor to a set number of AI calls per hour, with a daily cap for everyone.

## Run it locally

You need Node.js 24+, pnpm, Docker, a [PayPal sandbox app](https://developer.paypal.com/dashboard/applications/sandbox) and a [Claude API key](https://platform.claude.com/).

```bash
pnpm install
cp .env.example .env          # fill in the PayPal and Anthropic keys
docker compose up -d          # Postgres on port 5433
pnpm db:migrate
pnpm validate:paypal          # checks your sandbox app can invoice and pay out
pnpm seed:demo --send         # creates the example trip and sends its sandbox invoices
pnpm dev                      # http://localhost:3100
```

Locally, PayPal can't reach your webhook. Set `PAYPAL_WEBHOOK_SKIP_VERIFY=true` in `.env`, then run `pnpm simulate:payments`. It pays the next instalment of every traveller and delivers the matching webhooks, one round each time you run it.

| Script | What it does |
|---|---|
| `pnpm dev` | Development server on port 3100 |
| `pnpm typecheck`, `pnpm lint` | Type and lint checks |
| `pnpm validate:paypal` | Checks the sandbox app's Invoicing, Payouts and Webhooks access |
| `pnpm smoke:pot` | Tests the payout guardrails against the sandbox on a throwaway trip |
| `pnpm seed:demo [--send]` | Creates the example trip (and sends its invoices) |
| `pnpm simulate:payments` | Pays one round of instalments and delivers the webhooks |
| `pnpm db:generate`, `pnpm db:migrate` | Drizzle migrations |

The sandbox business account pays suppliers from its own balance, and simulated payments don't add to it. Give it a large balance in the developer dashboard (Sandbox accounts → the business account → PayPal balance).

## Deploy

`render.yaml` describes the web service and its Postgres database for [Render](https://render.com/). Create a Blueprint from the repository and enter the secrets when asked. Then add a webhook in your PayPal app pointing to `https://<your-service>.onrender.com/api/webhooks/paypal` for the invoicing and payouts events, and set `PAYPAL_WEBHOOK_ID` to its id.

Production builds use webpack (`next build --webpack`): Turbopack runs out of memory on Linux while bundling the Bryntum trial package. Development still uses Turbopack.

## Keys and secrets

No key is in this repository or its history. The PayPal and Anthropic keys live only in environment variables (`.env` locally, which git ignores, and Render's environment in production), and they are read only by server modules marked `server-only`, so they never reach the browser bundle. The demo runs against the PayPal sandbox, so no real money can move, and the Anthropic key has a monthly spending cap on top of the demo's rate limits.

## Code map

```
src/app/                      pages, server actions and the PayPal webhook route
src/components/               dashboard, setup steps, agent chat, pot jar, timeline
src/lib/agent/                the agent: tools, guardrails, automatic runs
src/lib/plan/                 extraction, split and instalment planning
src/lib/paypal/               Invoicing, Payouts and webhook verification
src/lib/pot.ts                pot balance and which deadlines it covers
src/db/schema.ts              Drizzle schema (money is integer cents)
scripts/                      seed, simulation and sandbox checks
```

Stack: Next.js 16, React 19, Tailwind 4, Postgres with Drizzle, the Anthropic TypeScript SDK and Bryntum Scheduler.

## License

[MIT](LICENSE)
