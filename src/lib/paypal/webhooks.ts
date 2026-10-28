import "server-only";
import { paypal } from "./client";

const HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

/** Asks PayPal whether this delivery really came from PayPal for our webhook. */
export async function verifyWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not set");
  const fields = Object.fromEntries(
    Object.entries(HEADERS).map(([key, header]) => [key, headers.get(header)]),
  );
  if (Object.values(fields).some((v) => !v)) return false;
  const res = await paypal<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    ...fields,
    webhook_id: webhookId,
    webhook_event: event,
  });
  return res.verification_status === "SUCCESS";
}
