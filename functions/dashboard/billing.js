import { requireUser } from "../_shared/auth.js";
import { syncCentralSubscription } from "../_shared/central-payments.js";

export async function onRequest(context) {
  if (context.env?.DB) {
    try {
      const { user } = await requireUser(context.request, context.env.DB, context.env);
      await syncCentralSubscription(context.env, user.id, {
        force: new URL(context.request.url).searchParams.get("central_payment") === "1",
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "profiles_central_payment_page_sync_failed",
        code: error?.code || "CENTRAL_PAYMENT_SYNC_FAILED",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return context.next();
}
