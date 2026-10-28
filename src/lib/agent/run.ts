import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AGENT_MODEL, claude, FALLBACK } from "../ai/claude";
import { logAction, payMilestone, remindTraveller } from "./actions";
import { tripOverview } from "./overview";

const SYSTEM = `You are TripPot, the money manager for one group trip. You work for the trip organizer.
You can read the trip's money status, remind travellers who are behind, and pay suppliers from the group pot.

How to act:
- Always call get_trip_overview before answering questions about money or deciding to act; never guess amounts.
- Amounts in tool data are integer cents in the trip currency. Show them to people as normal money (e.g. €120.00).
- Reminders: be warm and specific (what for, how much is left, the deadline, and why it matters, e.g. "the riad needs the deposit by Friday"). Write them in English unless told otherwise.
- Paying suppliers: only pay deadlines whose status is "funded". If a payment is blocked, explain why to the organizer in one sentence and suggest the next step.
- When the organizer asks you to do something, do it, then confirm briefly what you did. Keep answers short.`;

/** Runs the agent for one organizer request on one trip. Tools are bound to that trip. */
export async function runAgent(
  tripId: string,
  request: string,
  history: Anthropic.Beta.BetaMessageParam[] = [],
  // What the audit log shows as the trigger; defaults to the request itself.
  logAs = request,
) {
  const tools = [
    betaZodTool({
      name: "get_trip_overview",
      description:
        "Current money status of the trip: pot balance, every traveller's instalments (paid/owed/status/due date) and every supplier payment deadline with its status.",
      inputSchema: z.object({}),
      run: async () => JSON.stringify(await tripOverview(tripId)),
    }),
    betaZodTool({
      name: "send_payment_reminder",
      description:
        "Send a PayPal invoice reminder to a traveller for one unpaid instalment. Limited to one reminder per instalment every 24 hours.",
      inputSchema: z.object({
        instalmentId: z.string(),
        subject: z.string().describe("Short email subject"),
        note: z.string().describe("Personal message to the traveller, 1-3 sentences"),
        reason: z.string().describe("Why you are sending it, for the organizer's audit log"),
      }),
      run: async (input) =>
        JSON.stringify(await remindTraveller(tripId, input.instalmentId, input.subject, input.note, input.reason)),
    }),
    betaZodTool({
      name: "pay_supplier",
      description:
        "Pay one supplier payment deadline from the group pot via PayPal Payouts. Only works when the deadline's status is 'funded'; otherwise it is blocked and the reason is returned.",
      inputSchema: z.object({
        milestoneId: z.string(),
        reason: z.string().describe("Why you are paying now, for the organizer's audit log"),
      }),
      run: async (input) => JSON.stringify(await payMilestone(tripId, input.milestoneId, input.reason)),
    }),
  ];

  const final = await claude.beta.messages.toolRunner({
    model: AGENT_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools,
    max_iterations: 12,
    messages: [...history, { role: "user", content: request }],
  });

  const answer = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  await logAction(tripId, "answer", answer.slice(0, 280) || "(no answer)", logAs);
  return { answer, stopReason: final.stop_reason };
}
