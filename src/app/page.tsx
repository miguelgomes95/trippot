import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { AgentDemo } from "@/components/landing/agent-demo";
import { Architecture } from "@/components/landing/architecture";
import { EmailArtifact, InvoiceArtifact, PayoutArtifact, SplitArtifact } from "@/components/landing/artifacts";
import { Faq } from "@/components/landing/faq";
import { GroupChat } from "@/components/landing/group-chat";
import { LandingNav } from "@/components/landing/landing-nav";
import { PotStory } from "@/components/landing/pot-story";
import { SplitDemo } from "@/components/landing/split-demo";
import { formatMoney } from "@/lib/money";
import { myTripIds } from "@/lib/my-trips";
import { exampleTrip, tripsByIds } from "@/lib/queries";
import dashboard from "../../public/landing/dashboard.png";

const REPO_URL = "https://github.com/miguelgomes95/trippot";
const VIDEO_URL = "https://youtu.be/XZWa_kEoFl8";

const SOURCES = [
  {
    id: 1,
    text: "Airbnb, survey of 2,000 US adults by DKC Analytics, November 2017",
    href: "https://news.airbnb.com/airbnb-makes-group-travel-easy-with-global-launch-of-split-payments/",
  },
  {
    id: 2,
    text: "Zelle report (two surveys of 1,000 US adults each), reported by Fortune, 27 July 2026",
    href: "https://fortune.com/2026/07/27/genz-zelle-avoidance-economy-debt-group-expenses/",
  },
];

const STATS = [
  { value: "38%", text: "of American travellers have not received all the money owed to them from a group trip.", source: 1 },
  { value: "47%", text: "of Gen Z have gone into debt covering a group expense they expected to be repaid for.", source: 2 },
  { value: "20%", text: "of Gen Z who owe money have muted or ignored a group chat to avoid paying someone back.", source: 2 },
];

const STEPS: { title: string; body: string; tech: string; artifact: ReactNode }[] = [
  {
    title: "Read the bookings",
    body: "Paste the confirmation emails. Claude finds each supplier, its total and when each part has to be paid.",
    tech: "Claude Haiku 5.5",
    artifact: <EmailArtifact />,
  },
  {
    title: "Split the costs",
    body: "Write a note per person, like “skips the desert tour”. The agent decides who pays for what, and the sums are done in code, to the cent.",
    tech: "Claude Opus 5.5",
    artifact: <SplitArtifact />,
  },
  {
    title: "Collect from everyone",
    body: "Each traveller gets a PayPal invoice per payment date, due 10 days before the supplier needs the money. Late payers get a reminder.",
    tech: "PayPal Invoicing",
    artifact: <InvoiceArtifact />,
  },
  {
    title: "Pay the suppliers",
    body: "When the pot covers a deadline, the agent pays that supplier and writes down why. Anything above your limit waits for you.",
    tech: "PayPal Payouts and webhooks",
    artifact: <PayoutArtifact />,
  },
];

const GUARDRAILS = [
  "A supplier is paid only when the pot covers that deadline and every earlier one.",
  "Payments above the organizer's autopay limit wait for approval.",
  "Each deadline is paid once. PayPal rejects a repeat payout.",
  "If PayPal refuses a payout, the money stays set aside and the refusal is logged.",
  "Reminders go out at most once per invoice every 24 hours.",
  "Everything the agent does is logged with its reason.",
];

const AUDIENCES = [
  {
    who: "Friends planning a trip",
    body: "A villa for someone's 30th, a ski chalet, a stag weekend. One person books, and everyone pays their own part on time.",
  },
  {
    who: "Travel agents and consultants",
    body: "Group tours with deposits and balance dates. Collect from each traveller instead of one lead booker, and pay suppliers on schedule.",
  },
  {
    who: "Clubs, schools and choirs",
    body: "Tours paid in instalments, where the treasurer needs to see who is behind without keeping a spreadsheet.",
  },
];

const condensed = { fontStretch: "80%" } as const;
const sectionTitle = "text-balance font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[0.98] font-bold tracking-tight";
const lede = "mt-5 max-w-[36rem] text-lg text-muted";

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <LandingNav />

      <main>
        {/* Hero: the example trip, replayed. */}
        <section className="mx-auto grid max-w-6xl gap-14 px-5 pt-10 pb-24 sm:px-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-20 lg:pt-16">
          <div>
            <h1
              className="text-balance font-display text-[clamp(3.25rem,8vw,6.25rem)] leading-[0.92] font-extrabold tracking-[-0.02em]"
              style={{ fontStretch: "78%" }}
            >
              Stop being the bank for your group trip.
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg text-muted">
              TripPot is an AI agent for the money side of a group trip. It reads the booking confirmations, works out
              who owes what, collects from everyone with PayPal invoices and pays each supplier as soon as the pot
              covers it.
            </p>
            <Actions className="mt-9" />
            <Suspense fallback={<p className="mt-5 h-5" />}>
              <LiveNow />
            </Suspense>
          </div>
          <PotStory />
        </section>

        {/* The problem. */}
        <section id="problem" className="scroll-mt-16 bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
            <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className={sectionTitle} style={condensed}>
                  Somebody always ends up holding everyone&rsquo;s money.
                </h2>
                <p className={lede}>
                  They put the deposit on their own card. They work out a fair split when three people skip the desert
                  tour and one wants the single room. Then they spend weeks chasing eleven friends before every supplier
                  deadline.
                </p>
                <p className="mt-4 max-w-[32rem] text-lg">
                  TripPot takes that job. You paste the bookings and approve the big payments.
                </p>
              </div>
              <GroupChat />
            </div>
            <dl className="mt-20 grid gap-10 border-t border-line pt-10 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.value}>
                  <dt className="num font-display text-6xl font-extrabold tracking-tight" style={condensed}>
                    {s.value}
                  </dt>
                  <dd className="mt-2 max-w-[18rem] text-muted">
                    {s.text}
                    <a href={`#source-${s.source}`} className="ml-1 align-super text-xs text-violet hover:underline">
                      [{s.source}]
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works, step by step, on the example trip. */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 sm:px-10">
          <h2 className={`${sectionTitle} max-w-[40rem]`} style={condensed}>
            From confirmation emails to paid suppliers
          </h2>
          <p className={lede}>
            Here is what it does with the example trip: 12 friends, a riad, a desert tour and airport transfers in
            Marrakech.
          </p>
          <ol className="mt-16 space-y-20">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div className="flex gap-5">
                  <span
                    className="num font-display text-6xl leading-none font-extrabold text-saffron"
                    style={condensed}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-semibold">{step.title}</h3>
                    <p className="mt-2 max-w-[28rem] text-muted">{step.body}</p>
                    <p className="mt-4 text-sm font-medium">{step.tech}</p>
                  </div>
                </div>
                <div>{step.artifact}</div>
              </li>
            ))}
          </ol>

          <div className="mt-28">
            <h3 className="font-display text-3xl font-bold tracking-tight" style={condensed}>
              The whole trip on one screen
            </h3>
            <p className="mt-3 max-w-[38rem] text-muted">
              The pot with a line for each supplier deadline, every payment in and out on a timeline, and the agent
              beside it.
            </p>
          </div>
        </section>
        <div className="mx-auto -mt-12 max-w-[78rem] px-3 pb-24 sm:px-6">
          <figure className="overflow-hidden rounded-xl border border-line bg-paper shadow-[0_40px_80px_-40px_rgba(24,32,46,0.5)]">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
            </div>
            <Image
              src={dashboard}
              alt="The TripPot dashboard for Marrakech May 2027: the pot with €182.75 in it, the payment timeline, and the agent answering who still owes money"
              sizes="(min-width: 1248px) 1248px, 100vw"
              placeholder="blur"
              className="h-auto w-full"
            />
          </figure>
        </div>

        {/* Interactive split. */}
        <section id="try" className="scroll-mt-16 bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <h2 className={sectionTitle} style={condensed}>
                Try the split yourself
              </h2>
              <p className="max-w-[34rem] text-lg text-muted">
                Change who goes on the desert tour or who gets the single room. Every invoice updates with the same rules
                the app uses, and the shares still add up to the bookings, to the cent.
              </p>
            </div>
            <div className="mt-12">
              <SplitDemo />
            </div>
          </div>
        </section>

        {/* The agent. */}
        <section id="agent" className="scroll-mt-16 bg-ink text-white">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <h2 className={sectionTitle} style={condensed}>
                Ask it anything. It answers from the live numbers.
              </h2>
              <p className="max-w-[34rem] text-lg text-white/70">
                The agent reads the pot, the invoices and the deadlines through its tools, then answers in plain words. It
                also acts on its own when a payment comes in, and writes down why.
              </p>
            </div>
            <div className="mt-12">
              <AgentDemo />
            </div>
          </div>
        </section>

        {/* Architecture and guardrails. */}
        <section id="under-the-hood" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 sm:px-10">
          <h2 className={`${sectionTitle} max-w-[44rem]`} style={condensed}>
            It moves money, so the rules are in the code, not the prompt
          </h2>
          <p className={lede}>
            Ten steps from an email to a paid supplier. Claude handles the parts that need judgment, PayPal moves the
            money, and our code decides when it may move.
          </p>
          <div className="mt-12">
            <Architecture />
          </div>
          <ul className="mt-16 grid gap-x-10 sm:grid-cols-2">
            {GUARDRAILS.map((rule) => (
              <li key={rule} className="flex gap-4 border-t border-line py-4 text-lg">
                <span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-teal" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {/* Who it's for. */}
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
            <h2 className={`${sectionTitle} max-w-[40rem]`} style={condensed}>
              For anyone who collects money for a trip
            </h2>
            <ul className="mt-12 grid gap-10 sm:grid-cols-3">
              {AUDIENCES.map((a) => (
                <li key={a.who} className="border-t-2 border-saffron pt-5">
                  <h3 className="font-display text-xl font-semibold">{a.who}</h3>
                  <p className="mt-2 text-muted">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Questions. */}
        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-16 gap-10 px-5 py-24 sm:px-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <h2 className={sectionTitle} style={condensed}>
            Questions
          </h2>
          <Faq />
        </section>

        {/* Closing. */}
        <section className="bg-saffron">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-10">
            <h2
              className="mx-auto max-w-[44rem] text-balance font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-tight"
              style={condensed}
            >
              Watch it pay a supplier
            </h2>
            <p className="mx-auto mt-5 max-w-[34rem] text-lg">
              Open the example trip, press Pay as traveller on a few rows and see the pot fill. No sign-up, and
              everything runs in the PayPal sandbox.
            </p>
            <Actions className="mt-9 justify-center" secondary="bg-surface/40 ring-ink/20 hover:ring-ink" />
          </div>
        </section>

        <Suspense fallback={null}>
          <MyTrips />
        </Suspense>
      </main>

      <footer className="mx-auto max-w-6xl px-5 pt-10 pb-14 text-sm text-muted sm:px-10">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="font-display text-base font-bold text-ink">TripPot</p>
            <p className="mt-2 max-w-[28rem]">
              Built for the PayPal AI Hackathon 2026 with Claude, PayPal Invoicing, Payouts and Webhooks, and Bryntum
              Scheduler. No real money moves. The public demo limits how many AI calls each visitor can make per hour.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              <a href={REPO_URL} className="underline decoration-line underline-offset-2 hover:text-ink" rel="noopener">
                Source code on GitHub (MIT)
              </a>
              <a href={VIDEO_URL} className="underline decoration-line underline-offset-2 hover:text-ink" rel="noopener">
                Demo video
              </a>
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Sources</p>
            <ol className="mt-2 space-y-1.5">
              {SOURCES.map((s) => (
                <li key={s.id} id={`source-${s.id}`} className="scroll-mt-20">
                  [{s.id}]{" "}
                  <a href={s.href} className="underline decoration-line underline-offset-2 hover:text-ink" rel="noopener">
                    {s.text}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Actions({ className = "", secondary = "ring-line hover:ring-ink" }: { className?: string; secondary?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href="/example" className="rounded-lg bg-ink px-5 py-3 font-medium text-white hover:bg-ink/85">
        Open the example trip
      </Link>
      <Link href="/trips/new" className={`rounded-lg px-5 py-3 font-medium ring-1 ${secondary}`}>
        Plan your own
      </Link>
    </div>
  );
}

async function LiveNow() {
  await connection();
  const trip = await exampleTrip().catch(() => null);
  if (!trip) return <p className="mt-5 text-sm text-muted">No sign-up needed.</p>;
  const money = (cents: number) => formatMoney(cents, trip.currency);
  return (
    <p className="mt-5 flex items-start gap-2 text-sm text-muted">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" />
      <span>
        No sign-up. The example trip in the sandbox right now:{" "}
        <span className="num text-ink">
          {money(trip.collectedCents)} of {money(trip.owedCents)}
        </span>{" "}
        collected, {trip.suppliersPaid} of {trip.supplierDeadlines} supplier payments sent.
      </span>
    </p>
  );
}

async function MyTrips() {
  const trips = await tripsByIds(await myTripIds()).catch(() => []);
  if (!trips.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-10">
      <h2 className="font-display text-xl font-semibold">Your trips</h2>
      <p className="mt-1 text-sm text-muted">Trips you created in this browser.</p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/trips/${t.id}`} className="flex items-baseline justify-between py-3 hover:text-violet">
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-muted">{t.destination}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
