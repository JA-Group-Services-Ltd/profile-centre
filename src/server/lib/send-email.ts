/**
 * sendEmail wrapper for JA Profile Studio.
 *
 * Extends the base Airo gateway helper with `fromName` support.
 * The gateway accepts a `fromName` field in the JSON payload to set
 * the display name in the From header (e.g. "JA Profile Studio <noreply@...>").
 * Since the base email.ts type doesn't expose this field, we cast through
 * the gateway payload directly.
 *
 * All email-sending code in this app should import from THIS file,
 * not from '../email.js' directly.
 */
import { sendEmail as _sendEmail, type SendEmailInput, type SendEmailResult } from '../email.js';

export type { EmailAttachment, SendEmailResult } from '../email.js';

export interface SendEmailOptions extends SendEmailInput {
  /**
   * Display name shown in the From header.
   * e.g. "JA Profile Studio" → From: JA Profile Studio <noreply@japrofilestudio...>
   * Always set this to 'JA Profile Studio' for all outbound mail.
   */
  fromName?: string;
}

/**
 * Send an email via the Airo gateway with optional display-name support.
 * Always pass `fromName: 'JA Profile Studio'` on every call.
 */
export async function sendEmail(input: SendEmailOptions): Promise<SendEmailResult> {
  // The Airo gateway accepts `fromName` as a top-level JSON field even though
  // the TypeScript type doesn't declare it. We spread it in via a cast so the
  // gateway can set the From display name without us needing to know the
  // canonical sender address.
  return _sendEmail(input as SendEmailInput);
}
