import "server-only";
import { paypal } from "./client";
import { toPayPalValue } from "../money";

type Invoice = {
  id: string;
  status: string;
  detail: { metadata?: { recipient_view_url?: string } };
  due_amount?: { value: string };
  payments?: { paid_amount?: { value: string } };
};

export async function createAndSendInvoice(args: {
  instalmentId: string;
  tripName: string;
  organizerName: string;
  label: string;
  travellerName: string;
  travellerEmail: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  note?: string;
}) {
  const [givenName, ...rest] = args.travellerName.split(" ");
  const draft = await paypal<Invoice>(
    "POST",
    "/v2/invoicing/invoices",
    {
      detail: {
        currency_code: args.currency,
        reference: args.instalmentId,
        note: args.note,
        memo: `TripPot instalment ${args.instalmentId}`,
        payment_term: { due_date: args.dueDate },
      },
      // Shown as the sender on the invoice instead of the merchant account's name.
      invoicer: { business_name: `${args.organizerName} · ${args.tripName}` },
      primary_recipients: [
        {
          billing_info: {
            email_address: args.travellerEmail,
            name: { given_name: givenName, surname: rest.join(" ") || undefined },
          },
        },
      ],
      items: [
        {
          name: `${args.tripName}: ${args.label}`,
          quantity: "1",
          unit_amount: { currency_code: args.currency, value: toPayPalValue(args.amountCents) },
        },
      ],
      configuration: {
        allow_tip: false,
        // Travellers can pay in smaller chunks; the pot tracks every partial payment.
        partial_payment: { allow_partial_payment: true },
      },
    },
    { idempotencyKey: `invoice-${args.instalmentId}` },
  );

  await paypal("POST", `/v2/invoicing/invoices/${draft.id}/send`, { send_to_recipient: true }, {
    idempotencyKey: `invoice-send-${args.instalmentId}`,
  });
  const sent = await getInvoice(draft.id);
  return { invoiceId: sent.id, payerUrl: sent.detail.metadata?.recipient_view_url ?? null };
}

export const getInvoice = (invoiceId: string) => paypal<Invoice>("GET", `/v2/invoicing/invoices/${invoiceId}`);

export async function sendReminder(invoiceId: string, subject: string, note: string) {
  await paypal("POST", `/v2/invoicing/invoices/${invoiceId}/remind`, { subject, note });
}

// Sandbox/demo helper: records a payment on the invoice as if the traveller had paid.
export async function recordPayment(invoiceId: string, amountCents: number, currency: string) {
  return paypal<{ payment_id: string }>("POST", `/v2/invoicing/invoices/${invoiceId}/payments`, {
    method: "PAYPAL",
    payment_date: new Date().toISOString().slice(0, 10),
    amount: { currency_code: currency, value: toPayPalValue(amountCents) },
  });
}
