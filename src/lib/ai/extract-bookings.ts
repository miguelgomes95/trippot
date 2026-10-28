import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, EXTRACTION_MODEL } from "./claude";

const Milestone = z.object({
  label: z.string().describe('e.g. "30% deposit", "Balance"'),
  amount: z.number().describe("Amount in the booking currency, e.g. 540.00"),
  dueDate: z.string().describe("YYYY-MM-DD"),
});

export const ExtractedBooking = z.object({
  supplierName: z.string(),
  category: z.enum(["flight", "lodging", "activity", "transport", "other"]),
  currency: z.string().describe("ISO 4217 code, e.g. EUR"),
  total: z.number(),
  startsOn: z.string().nullable().describe("YYYY-MM-DD, null if not stated"),
  endsOn: z.string().nullable(),
  supplierPaypalEmail: z.string().nullable().describe("Only if the confirmation states a PayPal/payment email"),
  cancellationPolicy: z.string().nullable().describe("One sentence summary, null if not stated"),
  milestones: z
    .array(Milestone)
    .describe("Payment schedule owed to the supplier. If none is stated, one milestone for the full total"),
  perPersonNotes: z
    .array(z.string())
    .describe('Anything that changes who pays what, e.g. "single room supplement 90 EUR", "3 travellers skip the tour"'),
});
export type ExtractedBooking = z.infer<typeof ExtractedBooking>;

const Extraction = z.object({ bookings: z.array(ExtractedBooking) });

const SYSTEM = `You read booking confirmations for a group trip (emails, PDFs pasted as text, invoices) and extract structured data the organizer will use to collect money from travellers and pay suppliers.
Only use facts stated in the text. Never invent amounts, dates or emails; use null when something is missing.
Milestones must add up to the booking total. If the text gives percentages, convert them to amounts.
One confirmation can contain several bookings (e.g. outbound and return flights from different airlines): return each separately.`;

export async function extractBookings(confirmationText: string, tripContext: string) {
  const response = await claude.beta.messages.parse({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Trip: ${tripContext}\n\n<confirmation>\n${confirmationText}\n</confirmation>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to read this confirmation");
  if (!response.parsed_output) throw new Error(`Could not extract bookings (stop_reason=${response.stop_reason})`);
  return response.parsed_output.bookings;
}
