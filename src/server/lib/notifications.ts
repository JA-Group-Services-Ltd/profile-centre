/**
 * Platform notification helpers.
 * Sends email notifications for key events.
 * All calls are fire-and-forget — never throws to the caller.
 *
 * Anti-spam practices:
 *  - No emoji in subject lines
 *  - Both HTML and plain-text parts always sent
 *  - Consistent From/Reply-To
 *  - Uses branded email-templates helper
 *
 * Email preference categories:
 *  ESSENTIAL (always sent, no opt-out):
 *    security_alerts, billing_notices, sar_updates, legal_notices
 *  OPTIONAL (user can disable):
 *    support_replies, profile_status, enquiry_notifications, service_updates
 */
import { sendEmail } from './send-email.js';
import { getSecret } from '#airo/secrets';
import db from '../db.js';
import {
  welcomeEmail,
  adminNewSignupEmail,
  adminNewMessageEmail,
  adminSupportRequestEmail,
  adminPlanChangeEmail,
  adminIssueReportEmail,
  adminAccountPausedEmail,
  adminFeatureRequestEmail,
  adminVerificationRequestEmail,
  enquiryReceivedEmail,
  enquiryConfirmationEmail,
  securityAlertEmail,
  sarStatusEmail,
  supportReplyEmail,
  profileStatusEmail,
  planChangeEmail,
  featureActivatedEmail,
  passwordResetEmail,
  accountStatusEmail,
  verificationStatusEmail,
  accountClosureEmail,
  EMAIL_REPLY_TO,
} from './email-templates.js';

function adminEmail(): string | null {
  try {
    const v = getSecret('ADMIN_NOTIFICATION_EMAIL');
    return typeof v === 'string' && v.includes('@') ? v : null;
  } catch {
    return null;
  }
}

async function safe(fn: () => Promise<void>): Promise<void> {
  fn().catch(err => console.error('[notify]', err instanceof Error ? err.message : err));
}

// ── Email preference check ────────────────────────────────────────────────────
// Essential categories are always sent regardless of preferences.
// Optional categories respect the user's stored preference (default: enabled).
const ESSENTIAL_CATEGORIES = new Set([
  'security_alerts', 'billing_notices', 'sar_updates', 'legal_notices',
]);

function shouldSendEmail(userId: number, category: string): boolean {
  // Essential notifications are always sent
  if (ESSENTIAL_CATEGORIES.has(category)) return true;
  try {
    const row = db.prepare('SELECT email_notification_prefs FROM users WHERE id = ?').get(userId) as
      { email_notification_prefs: string | null } | undefined;
    if (!row?.email_notification_prefs) return true; // default: all on
    const prefs = JSON.parse(row.email_notification_prefs) as Record<string, boolean>;
    // If the key is absent, default to true (opt-in by default)
    return prefs[category] !== false;
  } catch {
    return true; // fail open — send rather than silently drop
  }
}

// ── User: Welcome email on account creation ───────────────────────────────────
export async function notifyWelcome(opts: {
  userEmail: string;
  userName: string;
}): Promise<void> {
  const { subject, html, text } = welcomeEmail({
    userName: opts.userName,
    userEmail: opts.userEmail,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: New message received ───────────────────────────────────────────────
export async function notifyNewMessage(opts: {
  senderName: string;
  senderEmail?: string;
  recipientUsername: string;
  preview: string;
  threadId: number;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminNewMessageEmail({
    senderName: opts.senderName,
    senderEmail: opts.senderEmail,
    recipientUsername: opts.recipientUsername,
    preview: opts.preview,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: New user signup ────────────────────────────────────────────────────
export async function notifyNewSignup(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  isReferral?: boolean;
  referralCode?: string;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminNewSignupEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: Plan change ────────────────────────────────────────────────────────
export async function notifyPlanChange(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  fromPlan: string;
  toPlan: string;
  action: 'upgrade' | 'downgrade' | 'cancel' | 'lifetime_granted' | 'lifetime_revoked';
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminPlanChangeEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: Support request ────────────────────────────────────────────────────
export async function notifySupportRequest(opts: {
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminSupportRequestEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: opts.userEmail });
  });
}

// ── Admin: User paused/unpaused ───────────────────────────────────────────────
export async function notifyUserPaused(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  paused: boolean;
  reason?: string;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminAccountPausedEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: Issue report submitted ─────────────────────────────────────────────
export async function notifyIssueReport(opts: {
  id: number;
  name: string;
  email: string;
  issueType: string;
  subject: string | null;
  description: string;
  pageUrl: string | null;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminIssueReportEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: Feature request ────────────────────────────────────────────────────
export async function notifyFeatureRequest(opts: {
  userName: string;
  userEmail: string;
  featureName: string;
  featureSlug: string;
  type: 'request' | 'interest';
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminFeatureRequestEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Feature activated ───────────────────────────────────────────────────
export async function notifyFeatureActivated(opts: {
  userEmail: string;
  userName?: string;
  featureName: string;
  accessType: string;
}): Promise<void> {
  const { subject, html, text } = featureActivatedEmail({
    userName: opts.userName ?? 'there',
    featureName: opts.featureName,
    accessType: opts.accessType,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: New enquiry received ────────────────────────────────────────────────
export async function notifyEnquiryReceived(opts: {
  ownerEmail: string;
  ownerName: string;
  ownerId?: number;
  senderName: string;
  senderEmail: string;
  message: string;
  profileName: string;
}): Promise<void> {
  if (opts.ownerId !== undefined && !shouldSendEmail(opts.ownerId, 'enquiry_notifications')) return;
  const { subject, html, text } = enquiryReceivedEmail({
    ownerName: opts.ownerName,
    senderName: opts.senderName,
    senderEmail: opts.senderEmail,
    message: opts.message,
    profileName: opts.profileName,
  });
  safe(async () => {
    await sendEmail({
      fromName: 'JA Profile Studio',
      to: opts.ownerEmail,
      subject,
      html,
      text,
      replyTo: opts.senderEmail,   // replies go to the person who sent the enquiry
    });
  });
}

// ── User: Security alert (ESSENTIAL — always sent) ────────────────────────────
export async function notifySecurityAlert(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  alertType: 'new_login' | 'password_changed' | 'account_locked' | 'suspicious_activity' | 'pin_changed';
  detail?: string;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
}): Promise<void> {
  // Security alerts are essential — always sent, no preference check
  const { subject, html, text } = securityAlertEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: SAR status update (ESSENTIAL — always sent) ────────────────────────
export async function notifySarStatusUpdate(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  requestType: string;
  status: string;
  statusLabel: string;
  requestId: number;
  adminNote?: string;
}): Promise<void> {
  // SAR updates are essential — always sent
  const { subject, html, text } = sarStatusEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Support reply ───────────────────────────────────────────────────────
export async function notifySupportReply(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  originalSubject: string;
  replyBody: string;
  ticketId?: number;
}): Promise<void> {
  if (opts.userId !== undefined && !shouldSendEmail(opts.userId, 'support_replies')) return;
  const { subject, html, text } = supportReplyEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Profile status change ───────────────────────────────────────────────
export async function notifyProfileStatus(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  profileName: string;
  status: 'published' | 'hidden' | 'suspended' | 'restored';
  reason?: string;
}): Promise<void> {
  if (opts.userId !== undefined && !shouldSendEmail(opts.userId, 'profile_status')) return;
  const { subject, html, text } = profileStatusEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Plan change (ESSENTIAL — billing notice) ────────────────────────────
export async function notifyUserPlanChange(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  action: 'upgrade' | 'downgrade' | 'cancel' | 'trial_started' | 'trial_ending';
  fromPlan?: string;
  toPlan?: string;
  trialEndsAt?: string;
}): Promise<void> {
  // Billing/plan changes are essential — always sent
  const { subject, html, text } = planChangeEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Password reset ──────────────────────────────────────────────────────
export async function notifyPasswordReset(opts: {
  userEmail: string;
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<void> {
  // Password reset is essential — always sent
  const { subject, html, text } = passwordResetEmail({
    userName: opts.userName,
    resetUrl: opts.resetUrl,
    expiresInMinutes: opts.expiresInMinutes,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Account suspended / restored / closed ───────────────────────────────
export async function notifyAccountStatus(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  action: 'suspended' | 'restored' | 'closed';
  reason?: string;
  effectiveDate?: string;
}): Promise<void> {
  // Account status changes are essential — always sent
  const { subject, html, text } = accountStatusEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Enquiry confirmation (to sender) ────────────────────────────────────
export async function notifyEnquiryConfirmation(opts: {
  senderEmail: string;
  senderName: string;
  recipientProfileName: string;
  messagePreview: string;
}): Promise<void> {
  const { subject, html, text } = enquiryConfirmationEmail({
    senderName: opts.senderName,
    recipientProfileName: opts.recipientProfileName,
    messagePreview: opts.messagePreview,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.senderEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Verification status update ─────────────────────────────────────────
export async function notifyVerificationStatus(opts: {
  userEmail: string;
  userName: string;
  userId?: number;
  profileName: string;
  status: 'approved' | 'rejected' | 'pending' | 'revoked';
  reason?: string;
}): Promise<void> {
  if (opts.userId !== undefined && !shouldSendEmail(opts.userId, 'profile_status')) return;
  const { subject, html, text } = verificationStatusEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── User: Account closure confirmation ───────────────────────────────────────
export async function notifyAccountClosure(opts: {
  userEmail: string;
  userName: string;
  requestId?: number;
  scheduledDeletionDate?: string;
}): Promise<void> {
  // Closure confirmation is essential — always sent
  const { subject, html, text } = accountClosureEmail({
    userName: opts.userName,
    userEmail: opts.userEmail,
    requestId: opts.requestId,
    scheduledDeletionDate: opts.scheduledDeletionDate,
  });
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to: opts.userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}

// ── Admin: Verification request submitted ────────────────────────────────────
export async function notifyAdminVerificationRequest(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  profileName: string;
  note?: string;
}): Promise<void> {
  const to = adminEmail();
  if (!to) return;
  const { subject, html, text } = adminVerificationRequestEmail(opts);
  safe(async () => {
    await sendEmail({ fromName: 'JA Profile Studio', to, subject, html, text, replyTo: EMAIL_REPLY_TO });
  });
}
