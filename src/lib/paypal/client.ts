import "server-only";

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError(res.status, data.error ?? "oauth_failed", data.error_description);
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(
    public status: number,
    public code: string,
    detail?: string,
    public debugId?: string,
  ) {
    super(`PayPal ${status} ${code}${detail ? `: ${detail}` : ""}`);
  }
}

export async function paypal<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  // PayPal-Request-Id makes POST retries safe (no duplicate invoices or payouts).
  if (opts.idempotencyKey) headers["PayPal-Request-Id"] = opts.idempotencyKey;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = data.details
      ?.map((d: { field?: string; issue?: string; description?: string }) =>
        [d.field, d.description ?? d.issue].filter(Boolean).join(": "),
      )
      .join("; ");
    throw new PayPalError(res.status, data.name ?? "request_failed", detail ?? data.message, data.debug_id);
  }
  return data as T;
}
