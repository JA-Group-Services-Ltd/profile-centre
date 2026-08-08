import { getSession } from "../_shared/auth.js";
import { synchroniseCentralProfileBilling } from "../_shared/stripe.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (context.request.method === "GET" && ["/api/auth/me", "/api/subscriptions"].includes(url.pathname) && context.env.DB) {
    try {
      const session = await getSession(context.request, context.env.DB);
      const userId = Number(session?.data?.userId);
      if (Number.isInteger(userId) && userId > 0) {
        await synchroniseCentralProfileBilling(context.env, userId);
      }
    } catch (error) {
      // Billing reconciliation must not make the core authenticated account API
      // unavailable. Checkout/portal routes still fail closed when Central
      // Payments itself is unavailable or the credential lacks payment scopes.
      console.warn("Sousa Murray Profiles Central Payments reconciliation paused", error);
    }
  }

  const response = await context.next();
  const headers = new Headers(response.headers);

  headers.set("cache-control", "no-store, max-age=0");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-robots-tag", "noindex, nofollow");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
