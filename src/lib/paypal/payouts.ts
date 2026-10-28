import "server-only";
import { paypal } from "./client";
import { toPayPalValue } from "../money";

type PayoutBatch = {
  batch_header: { payout_batch_id: string; batch_status: string };
  items?: { transaction_status?: string }[];
};

export async function paySupplier(args: {
  milestoneId: string;
  supplierEmail: string;
  amountCents: number;
  currency: string;
  note: string;
}) {
  // sender_batch_id is unique per milestone, so PayPal rejects a second payout for the same milestone.
  const res = await paypal<PayoutBatch>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `milestone-${args.milestoneId}`,
        email_subject: "You have a payment from TripPot",
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: args.supplierEmail,
          amount: { value: toPayPalValue(args.amountCents), currency: args.currency },
          note: args.note,
          sender_item_id: args.milestoneId,
        },
      ],
    },
    { idempotencyKey: `payout-${args.milestoneId}` },
  );
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

export const getPayoutBatch = (batchId: string) => paypal<PayoutBatch>("GET", `/v1/payments/payouts/${batchId}`);
