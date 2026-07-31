/**
 * Power Automate Marketing Consent Relay
 *
 * Fires a POST to the Power Automate HTTP trigger whenever a user's
 * marketing_consent changes. Runs fire-and-forget — never throws so it
 * cannot break the consent save flow.
 *
 * marketingConsentStatus must be exactly: "Opted In" | "Opted Out" | "Withdrawn"
 */
import { getSecret } from '#airo/secrets';

export interface ConsentPayload {
  userId: number;
  email: string;
  name: string;
  marketingConsent: boolean;
  /** ISO 8601 — when consent was originally given (for opt-out payloads, pass existing value if known) */
  consentGivenAt?: string;
  source: 'registration' | 'account_settings';
  platform: string;
  ipAddress?: string;
}

/**
 * Send marketing consent status to Power Automate.
 * Fire-and-forget — logs errors but never throws.
 */
export async function notifyMarketingConsent(payload: ConsentPayload): Promise<void> {
  const rawUrl = getSecret('POWER_AUTOMATE_CONSENT_URL');
  const url: string | undefined = typeof rawUrl === 'string' ? rawUrl : undefined;
  if (!url) {
    console.warn('[power-automate-consent] POWER_AUTOMATE_CONSENT_URL not set — skipping relay');
    return;
  }

  const now = new Date().toISOString();
  const isOptIn = payload.marketingConsent;

  // Exact field names and values required by the Power Automate / SharePoint flow.
  // marketingConsentStatus MUST be "Opted In", "Opted Out", or "Withdrawn" — exact casing.
  const body = {
    userAccountId: String(payload.userId),
    fullName: payload.name,
    emailAddress: payload.email,
    serviceBrand: payload.platform,
    marketingConsentStatus: isOptIn ? 'Opted In' : 'Opted Out',
    consentGivenDateTime: isOptIn ? now : (payload.consentGivenAt ?? ''),
    consentVersion: 'v1.0',
    sourcePage: payload.source === 'registration' ? 'Account Registration' : 'Account Settings',
    ipAddress: payload.ipAddress ?? '',
    microsoftGroupAdded: 'No',
    consentWithdrawnDateTime: isOptIn ? '' : now,
    notes: isOptIn
      ? 'Marketing consent captured via Profile Centre website'
      : 'Marketing consent withdrawn via Profile Centre website',
    unsubscribeMethod: isOptIn ? '' : 'Account settings',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[power-automate-consent] HTTP ${res.status}: ${text.slice(0, 300)}`);
    } else {
      console.log(
        `[power-automate-consent] Sent consent for user ${payload.userId} (${body.marketingConsentStatus})`,
      );
    }
  } catch (err) {
    console.error('[power-automate-consent] Fetch failed:', err);
  }
}
