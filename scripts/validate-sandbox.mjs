// Day-1 smoke test: checks that the PayPal sandbox APIs TripPot depends on work
// with this app's credentials. Run: node --env-file=.env scripts/validate-sandbox.mjs
const BASE = "https://api-m.sandbox.paypal.com";
const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in .env");

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
};

let token;
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.name ?? ""} ${data.message ?? ""} ${JSON.stringify(data.details ?? "")}`.trim());
  return data;
}

await check("OAuth token", async () => {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${data.error_description ?? data.error}`);
  token = data.access_token;
  const scopes = data.scope.split(" ");
  const want = ["invoicing", "payouts", "checkout", "webhook"];
  return want.map((w) => `${w}:${scopes.some((s) => s.includes(w)) ? "yes" : "NO"}`).join(" ");
});
if (!token) {
  console.table(results);
  process.exit(1);
}

let invoiceId;
await check("Invoicing: create draft (partial payment + due date)", async () => {
  const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const inv = await api("POST", "/v2/invoicing/invoices", {
    detail: { currency_code: "EUR", note: "TripPot sandbox test", payment_term: { due_date: due } },
    primary_recipients: [{ billing_info: { email_address: "traveller.test@example.com", name: { given_name: "Ana", surname: "Test" } } }],
    items: [{ name: "Riad Marrakech, share 1/12", quantity: "1", unit_amount: { currency_code: "EUR", value: "180.00" } }],
    configuration: { allow_tip: false, partial_payment: { allow_partial_payment: true, minimum_amount_due: { currency_code: "EUR", value: "60.00" } } },
  });
  invoiceId = inv.id ?? inv.href?.split("/").pop();
  return `id=${invoiceId}`;
});

await check("Invoicing: send", async () => {
  const r = await api("POST", `/v2/invoicing/invoices/${invoiceId}/send`, { send_to_recipient: true });
  return r.href ? `payer link ok` : "sent";
});

await check("Invoicing: record partial payment (simulates traveller paying 60€)", async () => {
  await api("POST", `/v2/invoicing/invoices/${invoiceId}/payments`, {
    method: "PAYPAL",
    payment_date: new Date().toISOString().slice(0, 10),
    amount: { currency_code: "EUR", value: "60.00" },
  });
  const inv = await api("GET", `/v2/invoicing/invoices/${invoiceId}`);
  return `status=${inv.status} paid=${inv.payments?.paid_amount?.value} due=${inv.due_amount?.value}`;
});

await check("Invoicing: send reminder", async () => {
  await api("POST", `/v2/invoicing/invoices/${invoiceId}/remind`, {
    subject: "Riad deposit due soon",
    note: "Hi Ana, the riad needs the deposit by Friday — 120€ left.",
  });
  return "reminder sent";
});

await check("Payouts: pay a supplier", async () => {
  const p = await api("POST", "/v1/payments/payouts", {
    sender_batch_header: { sender_batch_id: `trippot-${Date.now()}`, email_subject: "TripPot supplier payment" },
    items: [{ recipient_type: "EMAIL", amount: { value: "50.00", currency: "EUR" }, receiver: "riad.supplier@example.com", note: "Riad deposit" }],
  });
  const batchId = p.batch_header.payout_batch_id;
  await new Promise((r) => setTimeout(r, 4000));
  const s = await api("GET", `/v1/payments/payouts/${batchId}`);
  return `batch=${s.batch_header.batch_status} item=${s.items?.[0]?.transaction_status}`;
});

await check("Orders (Checkout): create", async () => {
  const o = await api("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "EUR", value: "180.00" }, description: "Trip share" }],
  });
  return `status=${o.status}`;
});

await check("Webhooks: list + available event types", async () => {
  const hooks = await api("GET", "/v1/notifications/webhooks");
  const types = await api("GET", "/v1/notifications/webhooks-event-types");
  const names = types.event_types.map((t) => t.name);
  const need = ["INVOICING.INVOICE.PAID", "PAYMENT.PAYOUTSBATCH.SUCCESS", "PAYMENT.CAPTURE.COMPLETED"];
  return `existing=${hooks.webhooks.length} ` + need.map((n) => `${n}:${names.includes(n) ? "yes" : "NO"}`).join(" ");
});

for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}\n   ${r.detail}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
