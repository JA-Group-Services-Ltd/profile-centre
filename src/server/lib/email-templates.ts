/**
 * Branded email template helpers for Profile Centre.
 *
 * Anti-spam best practices applied throughout:
 *  - No emoji in subject lines (spam filter trigger)
 *  - Both HTML and plain-text parts always included
 *  - Clear transactional / service email header
 *  - Consistent From / Reply-To usage
 *  - Unsubscribe footer for non-essential emails
 *  - No misleading marketing copy in transactional messages
 *  - Inline CSS only (email client compatibility)
 *  - Light professional design — white card, navy header/footer
 */

const BRAND_NAME = 'Profile Centre';
const BRAND_COMPANY = 'JA Group Services Ltd';
const BRAND_DOMAIN = 'japrofilestudio.jagroupservices.co.uk';
const BRAND_URL = `https://${BRAND_DOMAIN}`;
const SUPPORT_EMAIL = 'japrofilestudio@jagroupservices.co.uk';   // reply-to / support inbox
const NOREPLY_EMAIL = 'noreply@japrofilestudio.jagroupservices.co.uk'; // outbound reply-to
const PRIVACY_URL = `${BRAND_URL}/legal/privacy`;
const TERMS_URL = `${BRAND_URL}/legal/terms`;

// Exported so notifications.ts, email-status.ts, and other callers can pass
// the correct addresses to sendEmail().
//
// From (displayed sender): noreply@japrofilestudio.jagroupservices.co.uk
//   — set by the Airo gateway automatically from the app's attached domain.
//   — do NOT pass a custom `from` field; the gateway owns this.
//
// Reply-To: japrofilestudio@jagroupservices.co.uk
//   — when a recipient hits Reply, their email client opens a compose window
//     addressed to the support inbox, not the noreply address.
export const EMAIL_REPLY_TO = SUPPORT_EMAIL;   // japrofilestudio@jagroupservices.co.uk
export const EMAIL_NOREPLY  = NOREPLY_EMAIL;   // noreply@japrofilestudio.jagroupservices.co.uk (for reference)
export const EMAIL_SUPPORT  = SUPPORT_EMAIL;   // japrofilestudio@jagroupservices.co.uk

// ── Colour palette (light, professional) ─────────────────────────────────────
const C = {
  pageBg:    '#f0f4f8',   // outer page — light grey
  card:      '#ffffff',   // email body — pure white
  border:    '#dde3ea',   // card border
  headerBg:  '#1e3a5f',   // deep navy header
  footerBg:  '#1e3a5f',   // deep navy footer
  accent:    '#2563eb',   // blue links / buttons
  text:      '#1a202c',   // near-black body
  muted:     '#4a5568',   // secondary text
  dimmed:    '#718096',   // tertiary / meta text
  success:   '#16a34a',
  warning:   '#d97706',
  danger:    '#dc2626',
  white:     '#ffffff',
};

// ── Shared layout wrapper ─────────────────────────────────────────────────────

function htmlWrapper(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px 32px;">
        <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">

          <!-- Navy header bar -->
          <tr>
            <td style="background-color:${C.headerBg};border-radius:10px 10px 0 0;padding:24px 32px;">
              <a href="${BRAND_URL}" style="text-decoration:none;display:block;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${BRAND_NAME}</span>
                <span style="font-size:12px;color:rgba(255,255,255,0.6);display:block;margin-top:3px;">${BRAND_COMPANY}</span>
              </a>
            </td>
          </tr>

          <!-- White content card -->
          <tr>
            <td style="background-color:${C.card};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:36px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Navy footer bar -->
          <tr>
            <td style="background-color:${C.footerBg};border-radius:0 0 10px 10px;padding:22px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.8);">
                This is a service email from <strong style="color:#ffffff;">${BRAND_NAME}</strong> &mdash; ${BRAND_COMPANY}
              </p>
              <p style="margin:0 0 8px;font-size:11px;">
                <a href="${PRIVACY_URL}" style="color:rgba(255,255,255,0.65);text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                <a href="${TERMS_URL}" style="color:rgba(255,255,255,0.65);text-decoration:underline;">Terms of Service</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:rgba(255,255,255,0.65);text-decoration:underline;">Contact Support</a>
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
                &copy; ${new Date().getFullYear()} ${BRAND_COMPANY}. All rights reserved.<br />
                Registered in England &amp; Wales &middot; <a href="${BRAND_URL}" style="color:rgba(255,255,255,0.5);text-decoration:none;">${BRAND_DOMAIN}</a>
              </p>
            </td>
          </tr>

          <tr><td style="height:28px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Reusable HTML components ──────────────────────────────────────────────────

function h1(text: string, color = C.text): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${color};line-height:1.3;">${text}</h1>`;
}

function p(text: string, color = C.text, size = '15px'): string {
  return `<p style="margin:0 0 12px;font-size:${size};color:${color};line-height:1.6;">${text}</p>`;
}

function badge(text: string, color = C.accent): string {
  return `<span style="display:inline-block;background-color:${color}18;color:${color};border:1px solid ${color}40;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">${text}</span>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${C.border};font-size:13px;color:${C.muted};width:38%;vertical-align:top;">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${C.border};font-size:13px;color:${C.text};vertical-align:top;">${value}</td>
  </tr>`;
}

function ctaButton(label: string, url: string, color = C.accent): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:${color};border-radius:8px;">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function blockquote(text: string, borderColor = C.accent): string {
  return `<blockquote style="margin:12px 0;padding:12px 16px;border-left:3px solid ${borderColor};background-color:#f8fafc;border-radius:0 6px 6px 0;">
    <p style="margin:0;font-size:14px;color:${C.muted};line-height:1.6;font-style:italic;">${text}</p>
  </blockquote>`;
}

function alertBox(text: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info'): string {
  const colors = { info: C.accent, warning: C.warning, danger: C.danger, success: C.success };
  const c = colors[type];
  return `<div style="margin:16px 0;padding:12px 16px;background-color:${c}12;border:1px solid ${c}35;border-radius:8px;">
    <p style="margin:0;font-size:13px;color:${c};line-height:1.5;">${text}</p>
  </div>`;
}

function divider(): string {
  return `<hr style="margin:20px 0;border:none;border-top:1px solid ${C.border};" />`;
}

// ── Plain-text helpers ────────────────────────────────────────────────────────

function textFooter(): string {
  return `\n\n---\nThis is a service email from ${BRAND_NAME} (${BRAND_COMPANY}).\nPrivacy Policy: ${PRIVACY_URL}\nTerms of Service: ${TERMS_URL}\nSupport: ${SUPPORT_EMAIL}\n\n© ${new Date().getFullYear()} ${BRAND_COMPANY}. All rights reserved.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Welcome email (to new user on account creation) ──────────────────────────
export function welcomeEmail(opts: {
  userName: string;
  userEmail: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/overview`;
  const subject = `Welcome to ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Welcome', C.success)}
    <br /><br />
    ${h1(`Welcome to ${BRAND_NAME}, ${opts.userName.split(' ')[0]}!`)}
    ${p(`Your account has been created successfully. You can now build your personal and business profiles, share your QR code, and manage your digital presence all in one place.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Account email', opts.userEmail)}
      ${infoRow('Platform', BRAND_NAME)}
      ${infoRow('Operated by', BRAND_COMPANY)}
    </table>
    <br />
    ${alertBox('Your account is ready. Head to your dashboard to set up your profile and get started.', 'info')}
    ${ctaButton('Go to Dashboard', url)}
    ${p(`If you did not create this account, please contact us immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, `Welcome to ${BRAND_NAME} — your account is ready`);

  const text = `Welcome to ${BRAND_NAME}, ${opts.userName}!\n\nYour account has been created successfully.\n\nAccount email: ${opts.userEmail}\nPlatform: ${BRAND_NAME}\nOperated by: ${BRAND_COMPANY}\n\nGo to your dashboard: ${url}\n\nIf you did not create this account, contact us at ${SUPPORT_EMAIL}.${textFooter()}`;

  return { subject, html, text };
}

// ── New enquiry (to profile owner) ───────────────────────────────────────────
export function enquiryReceivedEmail(opts: {
  ownerName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  profileName: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/enquiries`;
  const subject = `New enquiry from ${opts.senderName} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('New Enquiry', C.accent)}
    <br /><br />
    ${h1('You have a new enquiry')}
    ${p(`Someone has sent a message through your <strong>${opts.profileName}</strong> profile.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('From', `${opts.senderName} &lt;${opts.senderEmail}&gt;`)}
      ${infoRow('Profile', opts.profileName)}
    </table>
    <br />
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Message:</p>
    ${blockquote(opts.message.slice(0, 500).replace(/\n/g, '<br />'))}
    ${ctaButton('View in Dashboard', url)}
    ${p(`Reply directly to <a href="mailto:${opts.senderEmail}" style="color:${C.accent};">${opts.senderEmail}</a> or manage enquiries in your dashboard.`, C.muted, '13px')}
  `, `New enquiry from ${opts.senderName} on your ${opts.profileName} profile`);

  const text = `New enquiry from ${opts.senderName} <${opts.senderEmail}>\nProfile: ${opts.profileName}\n\nMessage:\n${opts.message.slice(0, 500)}\n\nView in dashboard: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Security alert (to user) ──────────────────────────────────────────────────
export function securityAlertEmail(opts: {
  userName: string;
  alertType: 'new_login' | 'password_changed' | 'account_locked' | 'suspicious_activity' | 'pin_changed';
  detail?: string;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
}): { subject: string; html: string; text: string } {
  const labels: Record<string, string> = {
    new_login: 'New sign-in to your account',
    password_changed: 'Your password was changed',
    account_locked: 'Your account has been locked',
    suspicious_activity: 'Suspicious activity detected',
    pin_changed: 'Your profile PIN was changed',
  };
  const label = labels[opts.alertType] ?? 'Security alert';
  const subject = `Security alert: ${label} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Security Alert', C.warning)}
    <br /><br />
    ${h1(label, C.warning)}
    ${p(`Hi ${opts.userName}, we detected the following activity on your account.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${opts.timestamp ? infoRow('Time', opts.timestamp) : ''}
      ${opts.ip ? infoRow('IP address', opts.ip) : ''}
      ${opts.userAgent ? infoRow('Device', opts.userAgent.slice(0, 80)) : ''}
      ${opts.detail ? infoRow('Detail', opts.detail) : ''}
    </table>
    ${alertBox('If this was not you, contact our support team immediately.', 'warning')}
    ${ctaButton('Contact Support', `mailto:${SUPPORT_EMAIL}`, C.warning)}
    ${p('If you recognise this activity, no action is needed.', C.muted, '13px')}
  `, label);

  const text = `Security alert: ${label}\n\nHi ${opts.userName},\n\n${opts.detail ?? label}${opts.ip ? `\nIP: ${opts.ip}` : ''}${opts.timestamp ? `\nTime: ${opts.timestamp}` : ''}\n\nIf this was not you, contact support immediately: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── PIN verification code (support-pin mismatch flow) ────────────────────────
export function pinVerificationEmail(opts: {
  code: string;
}): { subject: string; html: string; text: string } {
  const subject = `Profile Centre — PIN verification code`;

  const html = htmlWrapper(`
    ${h1('PIN verification code')}
    ${p('You requested to set a custom support PIN, but the two entries did not match.')}
    ${p('To verify your identity and save your PIN, enter this code:')}
    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;background:#f0f4f8;border:2px solid #dde3ea;border-radius:10px;padding:16px 32px;font-size:2rem;font-weight:700;letter-spacing:0.25em;color:#1e3a5f;font-family:monospace;">${opts.code}</span>
    </div>
    ${alertBox('This code expires in 10 minutes. If you did not request this, you can safely ignore this email.', 'info')}
  `, 'PIN verification code');

  const text = `Your Profile Centre PIN verification code is: ${opts.code}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.${textFooter()}`;

  return { subject, html, text };
}

// ── SAR status update (to user) ───────────────────────────────────────────────
export function sarStatusEmail(opts: {
  userName: string;
  requestType: string;
  status: string;
  statusLabel: string;
  requestId: number;
  adminNote?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/data-requests`;
  const subject = `Data request update: ${opts.statusLabel} — ${BRAND_NAME}`;

  const statusColors: Record<string, string> = {
    pending: C.warning,
    in_review: C.accent,
    identity_verified: C.accent,
    fulfilled: C.success,
    rejected: C.danger,
    cancelled: C.dimmed,
  };
  const statusColor = statusColors[opts.status] ?? C.accent;

  const html = htmlWrapper(`
    ${badge('Data Request Update', statusColor)}
    <br /><br />
    ${h1('Your data request has been updated')}
    ${p(`Hi ${opts.userName}, your ${opts.requestType} request (Ref #${opts.requestId}) has been updated.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Request type', opts.requestType)}
      ${infoRow('Reference', `#${opts.requestId}`)}
      ${infoRow('Status', `<span style="color:${statusColor};font-weight:600;">${opts.statusLabel}</span>`)}
    </table>
    ${opts.adminNote ? `<br /><p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Note from our team:</p>${blockquote(opts.adminNote)}` : ''}
    ${ctaButton('View Request Status', url)}
    ${p(`If you have questions, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, `Your ${opts.requestType} request is now: ${opts.statusLabel}`);

  const text = `Data request update\n\nHi ${opts.userName},\n\nYour ${opts.requestType} request (Ref #${opts.requestId}) status: ${opts.statusLabel}${opts.adminNote ? `\n\nNote from our team:\n${opts.adminNote}` : ''}\n\nView your request: ${url}\nSupport: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Support reply (to user) ───────────────────────────────────────────────────
export function supportReplyEmail(opts: {
  userName: string;
  originalSubject: string;
  replyBody: string;
  ticketId?: number;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/support`;
  const subject = `Re: ${opts.originalSubject} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Support Reply', C.success)}
    <br /><br />
    ${h1('We have replied to your support request')}
    ${p(`Hi ${opts.userName}, our team has responded to your request.`)}
    ${opts.ticketId ? `<p style="margin:0 0 12px;font-size:13px;color:${C.muted};">Ticket reference: <strong style="color:${C.text};">#${opts.ticketId}</strong></p>` : ''}
    ${divider()}
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Reply from our team:</p>
    ${blockquote(opts.replyBody.slice(0, 1000).replace(/\n/g, '<br />'), C.success)}
    ${ctaButton('View Full Conversation', url)}
    ${p(`To reply, visit your dashboard or email <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, `Our team has replied to: ${opts.originalSubject}`);

  const text = `Support reply\n\nHi ${opts.userName},\n\nOur team has replied to your request: "${opts.originalSubject}"${opts.ticketId ? ` (Ticket #${opts.ticketId})` : ''}\n\n${opts.replyBody.slice(0, 1000)}\n\nView conversation: ${url}\nSupport: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Profile status change (to user) ──────────────────────────────────────────
export function profileStatusEmail(opts: {
  userName: string;
  profileName: string;
  status: 'published' | 'hidden' | 'suspended' | 'restored';
  reason?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/profile`;
  const labels: Record<string, string> = {
    published: 'Your profile is now live',
    hidden: 'Your profile has been hidden',
    suspended: 'Your profile has been suspended',
    restored: 'Your profile has been restored',
  };
  const colors: Record<string, string> = {
    published: C.success,
    hidden: C.warning,
    suspended: C.danger,
    restored: C.success,
  };
  const label = labels[opts.status] ?? 'Profile status changed';
  const color = colors[opts.status] ?? C.accent;
  const subject = `Profile update: ${label} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Profile Update', color)}
    <br /><br />
    ${h1(label, color)}
    ${p(`Hi ${opts.userName}, the status of your profile <strong>${opts.profileName}</strong> has changed.`)}
    ${opts.reason ? `${divider()}${p(`Reason: ${opts.reason}`, C.muted, '13px')}` : ''}
    ${opts.status === 'suspended' ? alertBox('If you believe this is an error, please contact our support team.', 'danger') : ''}
    ${ctaButton('Go to Dashboard', url)}
    ${p(`Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, `${opts.profileName}: ${label}`);

  const text = `Profile update: ${label}\n\nHi ${opts.userName},\n\nYour profile "${opts.profileName}" status: ${label}${opts.reason ? `\nReason: ${opts.reason}` : ''}\n\nDashboard: ${url}\nSupport: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Account/plan change (to user) ─────────────────────────────────────────────
export function planChangeEmail(opts: {
  userName: string;
  action: 'upgrade' | 'downgrade' | 'cancel' | 'trial_started' | 'trial_ending';
  fromPlan?: string;
  toPlan?: string;
  trialEndsAt?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/billing`;
  const labels: Record<string, string> = {
    upgrade: 'Your plan has been upgraded',
    downgrade: 'Your plan has been changed',
    cancel: 'Your subscription has been cancelled',
    trial_started: 'Your free trial has started',
    trial_ending: 'Your free trial is ending soon',
  };
  const label = labels[opts.action] ?? 'Plan update';
  const subject = `Account update: ${label} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Account Update', C.accent)}
    <br /><br />
    ${h1(label)}
    ${p(`Hi ${opts.userName}, here is an update about your ${BRAND_NAME} account.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${opts.fromPlan ? infoRow('Previous plan', opts.fromPlan) : ''}
      ${opts.toPlan ? infoRow('New plan', opts.toPlan) : ''}
      ${opts.trialEndsAt ? infoRow('Trial ends', opts.trialEndsAt) : ''}
    </table>
    ${opts.action === 'cancel' ? alertBox('Your access will continue until the end of your current billing period.', 'warning') : ''}
    ${ctaButton('Manage Billing', url)}
    ${p(`Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, label);

  const text = `Account update: ${label}\n\nHi ${opts.userName},\n\n${label}${opts.fromPlan ? `\nPrevious plan: ${opts.fromPlan}` : ''}${opts.toPlan ? `\nNew plan: ${opts.toPlan}` : ''}${opts.trialEndsAt ? `\nTrial ends: ${opts.trialEndsAt}` : ''}\n\nManage billing: ${url}\nSupport: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Feature activated (to user) ───────────────────────────────────────────────
export function featureActivatedEmail(opts: {
  userName: string;
  featureName: string;
  accessType: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/overview`;
  const subject = `Feature activated: ${opts.featureName} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Feature Activated', C.success)}
    <br /><br />
    ${h1(`${opts.featureName} is now active`)}
    ${p(`Hi ${opts.userName}, the feature <strong>${opts.featureName}</strong> has been activated on your account.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Feature', opts.featureName)}
      ${infoRow('Access type', opts.accessType)}
    </table>
    ${ctaButton('Go to Dashboard', url)}
  `, `${opts.featureName} is now active on your account`);

  const text = `Feature activated: ${opts.featureName}\n\nHi ${opts.userName},\n\n${opts.featureName} has been activated on your account.\nAccess type: ${opts.accessType}\n\nDashboard: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: new signup notification ───────────────────────────────────────────
export function adminNewSignupEmail(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  isReferral?: boolean;
  referralCode?: string;
}): { subject: string; html: string; text: string } {
  const subject = `New signup: ${opts.userName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/users`;

  const html = htmlWrapper(`
    ${badge('New Signup', C.success)}
    <br /><br />
    ${h1('New user registered')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Name', opts.userName)}
      ${infoRow('Email', opts.userEmail)}
      ${infoRow('User ID', `#${opts.userId}`)}
      ${opts.isReferral ? infoRow('Referred via', opts.referralCode ?? 'referral link') : ''}
    </table>
    ${ctaButton('View in Admin', url)}
  `, `New signup: ${opts.userName}`);

  const text = `New signup: ${opts.userName} <${opts.userEmail}> (ID #${opts.userId})${opts.isReferral ? ` via referral ${opts.referralCode}` : ''}\n\nAdmin: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: new message notification ──────────────────────────────────────────
export function adminNewMessageEmail(opts: {
  senderName: string;
  senderEmail?: string;
  recipientUsername: string;
  preview: string;
}): { subject: string; html: string; text: string } {
  const subject = `New message from ${opts.senderName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/dashboard/messages`;

  const html = htmlWrapper(`
    ${badge('New Message', C.accent)}
    <br /><br />
    ${h1('New message received')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('From', `${opts.senderName}${opts.senderEmail ? ` &lt;${opts.senderEmail}&gt;` : ''}`)}
      ${infoRow('To profile', `@${opts.recipientUsername}`)}
    </table>
    <br />
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Preview:</p>
    ${blockquote(opts.preview.slice(0, 200))}
    ${ctaButton('View in Dashboard', url)}
  `, `New message from ${opts.senderName}`);

  const text = `New message from ${opts.senderName}${opts.senderEmail ? ` <${opts.senderEmail}>` : ''} to @${opts.recipientUsername}\n\n${opts.preview.slice(0, 200)}\n\nView: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: support request notification ──────────────────────────────────────
export function adminSupportRequestEmail(opts: {
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
}): { subject: string; html: string; text: string } {
  const emailSubject = `Support request: ${opts.subject} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/support-requests`;

  const html = htmlWrapper(`
    ${badge('Support Request', C.warning)}
    <br /><br />
    ${h1('New support request')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('From', `${opts.userName} &lt;${opts.userEmail}&gt;`)}
      ${infoRow('Subject', opts.subject)}
    </table>
    <br />
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Message:</p>
    ${blockquote(opts.message.slice(0, 1000).replace(/\n/g, '<br />'))}
    ${ctaButton('View in Admin', url)}
  `, `Support request from ${opts.userName}: ${opts.subject}`);

  const text = `Support request from ${opts.userName} <${opts.userEmail}>\nSubject: ${opts.subject}\n\n${opts.message.slice(0, 1000)}\n\nAdmin: ${url}${textFooter()}`;

  return { subject: emailSubject, html, text };
}

// ── Admin: plan change notification ──────────────────────────────────────────
export function adminPlanChangeEmail(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  fromPlan: string;
  toPlan: string;
  action: string;
}): { subject: string; html: string; text: string } {
  const actionLabels: Record<string, string> = {
    upgrade: 'Plan upgraded',
    downgrade: 'Plan downgraded',
    cancel: 'Subscription cancelled',
    lifetime_granted: 'Lifetime access granted',
    lifetime_revoked: 'Lifetime access revoked',
  };
  const label = actionLabels[opts.action] ?? 'Plan changed';
  const subject = `${label}: ${opts.userName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/users`;

  const html = htmlWrapper(`
    ${badge(label, C.accent)}
    <br /><br />
    ${h1(label)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('User', `${opts.userName} &lt;${opts.userEmail}&gt;`)}
      ${infoRow('User ID', `#${opts.userId}`)}
      ${infoRow('From', opts.fromPlan)}
      ${infoRow('To', opts.toPlan)}
    </table>
    ${ctaButton('View in Admin', url)}
  `, `${label}: ${opts.userName}`);

  const text = `${label}: ${opts.userName} <${opts.userEmail}> (ID #${opts.userId})\nFrom: ${opts.fromPlan} → To: ${opts.toPlan}\n\nAdmin: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: issue report notification ─────────────────────────────────────────
export function adminIssueReportEmail(opts: {
  id: number;
  name: string;
  email: string;
  issueType: string;
  subject: string | null;
  description: string;
  pageUrl: string | null;
}): { subject: string; html: string; text: string } {
  const emailSubject = `Issue report #${opts.id}: ${opts.issueType} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/support-requests`;

  const html = htmlWrapper(`
    ${badge(`Issue Report #${opts.id}`, C.warning)}
    <br /><br />
    ${h1(`New issue report #${opts.id}`, C.warning)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('From', `${opts.name} &lt;${opts.email}&gt;`)}
      ${infoRow('Type', opts.issueType)}
      ${opts.subject ? infoRow('Subject', opts.subject) : ''}
      ${opts.pageUrl ? infoRow('Page', `<a href="${opts.pageUrl}" style="color:${C.accent};">${opts.pageUrl}</a>`) : ''}
    </table>
    <br />
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Description:</p>
    ${blockquote(opts.description.slice(0, 1000).replace(/\n/g, '<br />'))}
    ${ctaButton('View in Admin', url)}
  `, `Issue report #${opts.id} from ${opts.name}`);

  const text = `Issue report #${opts.id} from ${opts.name} <${opts.email}>\nType: ${opts.issueType}${opts.subject ? `\nSubject: ${opts.subject}` : ''}${opts.pageUrl ? `\nPage: ${opts.pageUrl}` : ''}\n\n${opts.description.slice(0, 500)}\n\nAdmin: ${url}${textFooter()}`;

  return { subject: emailSubject, html, text };
}

// ── Admin: account paused/unpaused ───────────────────────────────────────────
export function adminAccountPausedEmail(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  paused: boolean;
  reason?: string;
}): { subject: string; html: string; text: string } {
  const label = opts.paused ? 'Account paused' : 'Account unpaused';
  const subject = `${label}: ${opts.userName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/users`;

  const html = htmlWrapper(`
    ${badge(label, opts.paused ? C.warning : C.success)}
    <br /><br />
    ${h1(label, opts.paused ? C.warning : C.success)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('User', `${opts.userName} &lt;${opts.userEmail}&gt;`)}
      ${infoRow('User ID', `#${opts.userId}`)}
      ${opts.reason ? infoRow('Reason', opts.reason) : ''}
    </table>
    ${ctaButton('View in Admin', url)}
  `, `${label}: ${opts.userName}`);

  const text = `${label}: ${opts.userName} <${opts.userEmail}> (ID #${opts.userId})${opts.reason ? `\nReason: ${opts.reason}` : ''}\n\nAdmin: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: feature request ────────────────────────────────────────────────────
export function adminFeatureRequestEmail(opts: {
  userName: string;
  userEmail: string;
  featureName: string;
  featureSlug: string;
  type: 'request' | 'interest';
}): { subject: string; html: string; text: string } {
  const isInterest = opts.type === 'interest';
  const label = isInterest ? 'Register interest' : 'Feature request';
  const subject = `${label}: ${opts.featureName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/features`;

  const html = htmlWrapper(`
    ${badge(label, C.accent)}
    <br /><br />
    ${h1(`${label}: ${opts.featureName}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Customer', `${opts.userName} &lt;${opts.userEmail}&gt;`)}
      ${infoRow('Feature', opts.featureName)}
      ${infoRow('Slug', opts.featureSlug)}
      ${infoRow('Type', label)}
    </table>
    ${ctaButton('View Features', url)}
  `, `${label}: ${opts.featureName} from ${opts.userName}`);

  const text = `${label}: ${opts.featureName}\nCustomer: ${opts.userName} <${opts.userEmail}>\nFeature slug: ${opts.featureSlug}\n\nAdmin: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin broadcast / compose email (to users) ───────────────────────────────
// Used by the admin Compose Email feature. Always uses the branded template —
// no custom domain, no inline HTML builder. Omit `from` — gateway uses canonical sender.
export function adminBroadcastEmail(opts: {
  recipientName?: string;
  subject: string;
  body: string;
}): { subject: string; html: string; text: string } {
  const greeting = opts.recipientName ? `Hi ${opts.recipientName},` : 'Hello,';
  const bodyHtml = opts.body.replace(/\n/g, '<br />');

  const html = htmlWrapper(`
    ${h1(opts.subject)}
    ${p(greeting)}
    <div style="color:${C.text};font-size:15px;line-height:1.7;margin:0 0 24px;">${bodyHtml}</div>
    ${divider()}
    ${p(`If you have any questions, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, opts.subject);

  const text = `${greeting}\n\n${opts.body}\n\n— The ${BRAND_NAME} Team\n\nQuestions? ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject: opts.subject, html, text };
}

// ── Password reset (to user) ──────────────────────────────────────────────────
export function passwordResetEmail(opts: {
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): { subject: string; html: string; text: string } {
  const expires = opts.expiresInMinutes ?? 30;
  const subject = `Reset your password — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Password Reset', C.warning)}
    <br /><br />
    ${h1('Reset your password')}
    ${p(`Hi ${opts.userName}, we received a request to reset the password for your ${BRAND_NAME} account.`)}
    ${alertBox(`This link expires in ${expires} minutes. If you did not request a password reset, you can safely ignore this email — your password will not change.`, 'warning')}
    ${ctaButton('Reset My Password', opts.resetUrl, C.warning)}
    ${divider()}
    ${p('If the button above does not work, copy and paste this link into your browser:', C.muted, '13px')}
    <p style="margin:0 0 12px;font-size:12px;color:${C.accent};word-break:break-all;">${opts.resetUrl}</p>
    ${p('For security, this link can only be used once. If you need a new link, visit the login page and request another reset.', C.muted, '12px')}
  `, 'Reset your Profile Centre password');

  const text = `Reset your password — ${BRAND_NAME}\n\nHi ${opts.userName},\n\nWe received a request to reset your password. Click the link below (expires in ${expires} minutes):\n\n${opts.resetUrl}\n\nIf you did not request this, ignore this email — your password will not change.${textFooter()}`;

  return { subject, html, text };
}

// ── Account suspended / restored / closed (to user) ──────────────────────────
export function accountStatusEmail(opts: {
  userName: string;
  action: 'suspended' | 'restored' | 'closed';
  reason?: string;
  effectiveDate?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/overview`;
  const labels: Record<string, string> = {
    suspended: 'Your account has been suspended',
    restored:  'Your account has been restored',
    closed:    'Your account has been closed',
  };
  const colors: Record<string, string> = {
    suspended: C.danger,
    restored:  C.success,
    closed:    C.warning,
  };
  const label = labels[opts.action] ?? 'Account status update';
  const color = colors[opts.action] ?? C.accent;
  const subject = `Account update: ${label} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Account Update', color)}
    <br /><br />
    ${h1(label, color)}
    ${p(`Hi ${opts.userName}, here is an important update about your ${BRAND_NAME} account.`)}
    ${opts.reason ? `${divider()}${p(`Reason: ${opts.reason}`, C.muted, '13px')}` : ''}
    ${opts.effectiveDate ? p(`Effective: ${opts.effectiveDate}`, C.muted, '13px') : ''}
    ${opts.action === 'suspended' ? alertBox('Your profile and data are preserved. If you believe this is an error, please contact our support team.', 'danger') : ''}
    ${opts.action === 'closed' ? alertBox('Your data will be retained for 30 days in accordance with our Privacy Policy, then permanently deleted.', 'warning') : ''}
    ${opts.action === 'restored' ? alertBox('Your account is fully active again. All your profiles and data are intact.', 'success') : ''}
    ${opts.action !== 'closed' ? ctaButton('Go to Dashboard', url) : ''}
    ${p(`Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, label);

  const text = `Account update: ${label}\n\nHi ${opts.userName},\n\n${label}${opts.reason ? `\nReason: ${opts.reason}` : ''}${opts.effectiveDate ? `\nEffective: ${opts.effectiveDate}` : ''}\n\nSupport: ${SUPPORT_EMAIL}${opts.action !== 'closed' ? `\nDashboard: ${url}` : ''}${textFooter()}`;

  return { subject, html, text };
}

// ── Enquiry confirmation (to the person who sent the enquiry) ─────────────────
export function enquiryConfirmationEmail(opts: {
  senderName: string;
  recipientProfileName: string;
  messagePreview: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your enquiry has been sent — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Enquiry Sent', C.success)}
    <br /><br />
    ${h1('Your message has been sent')}
    ${p(`Hi ${opts.senderName}, your enquiry has been delivered to <strong>${opts.recipientProfileName}</strong>.`)}
    ${divider()}
    <p style="margin:0 0 6px;font-size:13px;color:${C.muted};">Your message:</p>
    ${blockquote(opts.messagePreview.slice(0, 300).replace(/\n/g, '<br />'))}
    ${alertBox('The recipient will reply directly to your email address. Please check your inbox and spam folder.', 'info')}
    ${p(`If you have any questions, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, `Your enquiry to ${opts.recipientProfileName} has been sent`);

  const text = `Your enquiry has been sent — ${BRAND_NAME}\n\nHi ${opts.senderName},\n\nYour message to ${opts.recipientProfileName} has been delivered.\n\nYour message:\n${opts.messagePreview.slice(0, 300)}\n\nThe recipient will reply to your email address directly.${textFooter()}`;

  return { subject, html, text };
}

// ── Verification status update (to user) ─────────────────────────────────────
export function verificationStatusEmail(opts: {
  userName: string;
  profileName: string;
  status: 'approved' | 'rejected' | 'pending' | 'revoked';
  reason?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const url = opts.dashboardUrl ?? `${BRAND_URL}/dashboard/profile`;
  const labels: Record<string, string> = {
    approved: 'Your profile has been verified',
    rejected: 'Your verification request was not approved',
    pending:  'Your verification request is under review',
    revoked:  'Your profile verification has been removed',
  };
  const colors: Record<string, string> = {
    approved: C.success,
    rejected: C.danger,
    pending:  C.warning,
    revoked:  C.warning,
  };
  const label = labels[opts.status] ?? 'Verification update';
  const color = colors[opts.status] ?? C.accent;
  const subject = `Verification update: ${label} — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Verification Update', color)}
    <br /><br />
    ${h1(label, color)}
    ${p(`Hi ${opts.userName}, here is an update on the verification status of your profile <strong>${opts.profileName}</strong>.`)}
    ${opts.reason ? `${divider()}${p(`Note from our team: ${opts.reason}`, C.muted, '13px')}` : ''}
    ${opts.status === 'approved' ? alertBox('A verified badge will now appear on your public profile.', 'success') : ''}
    ${opts.status === 'rejected' ? alertBox('You may reapply for verification after addressing the reason above. Contact support if you have questions.', 'danger') : ''}
    ${ctaButton('View Your Profile', url)}
    ${p(`Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a>.`, C.muted, '13px')}
  `, label);

  const text = `Verification update: ${label}\n\nHi ${opts.userName},\n\nProfile: ${opts.profileName}\nStatus: ${label}${opts.reason ? `\nNote: ${opts.reason}` : ''}\n\nDashboard: ${url}\nSupport: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Account closure confirmation (to user) ────────────────────────────────────
export function accountClosureEmail(opts: {
  userName: string;
  userEmail: string;
  requestId?: number;
  scheduledDeletionDate?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Account closure confirmed — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Account Closure', C.warning)}
    <br /><br />
    ${h1('Your account closure has been confirmed')}
    ${p(`Hi ${opts.userName}, we have received your request to close your ${BRAND_NAME} account.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Account email', opts.userEmail)}
      ${opts.requestId ? infoRow('Request reference', `#${opts.requestId}`) : ''}
      ${opts.scheduledDeletionDate ? infoRow('Data deletion date', opts.scheduledDeletionDate) : ''}
    </table>
    ${alertBox('Your data will be retained for 30 days in accordance with our Privacy Policy, then permanently and irreversibly deleted. You will not be able to recover your account after this date.', 'warning')}
    ${p(`If you changed your mind and wish to keep your account, please contact us immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.accent};">${SUPPORT_EMAIL}</a> before the deletion date.`, C.muted, '13px')}
  `, 'Your Profile Centre account closure is confirmed');

  const text = `Account closure confirmed — ${BRAND_NAME}\n\nHi ${opts.userName},\n\nWe have received your account closure request.\nAccount: ${opts.userEmail}${opts.requestId ? `\nReference: #${opts.requestId}` : ''}${opts.scheduledDeletionDate ? `\nData deletion date: ${opts.scheduledDeletionDate}` : ''}\n\nYour data will be retained for 30 days then permanently deleted.\n\nTo cancel this request, contact us immediately: ${SUPPORT_EMAIL}${textFooter()}`;

  return { subject, html, text };
}

// ── Admin: verification request submitted ─────────────────────────────────────
export function adminVerificationRequestEmail(opts: {
  userName: string;
  userEmail: string;
  userId: number;
  profileName: string;
  note?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Verification request: ${opts.userName} — ${BRAND_NAME}`;
  const url = `${BRAND_URL}/admin/profiles`;

  const html = htmlWrapper(`
    ${badge('Verification Request', C.accent)}
    <br /><br />
    ${h1('New profile verification request')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('User', `${opts.userName} &lt;${opts.userEmail}&gt;`)}
      ${infoRow('User ID', `#${opts.userId}`)}
      ${infoRow('Profile', opts.profileName)}
      ${opts.note ? infoRow('Note', opts.note) : ''}
    </table>
    ${ctaButton('Review in Admin', url)}
  `, `Verification request from ${opts.userName}`);

  const text = `Verification request: ${opts.userName} <${opts.userEmail}> (ID #${opts.userId})\nProfile: ${opts.profileName}${opts.note ? `\nNote: ${opts.note}` : ''}\n\nAdmin: ${url}${textFooter()}`;

  return { subject, html, text };
}

// ── Test email ────────────────────────────────────────────────────────────────
export function testEmail(opts: {
  recipientEmail: string;
  sentAt: string;
}): { subject: string; html: string; text: string } {
  const subject = `Email delivery test — ${BRAND_NAME}`;

  const html = htmlWrapper(`
    ${badge('Test Email', C.success)}
    <br /><br />
    ${h1('Email delivery is working')}
    ${p('This is a test email sent from the admin panel to verify that the email delivery pipeline is working correctly.')}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Sent to', opts.recipientEmail)}
      ${infoRow('Sent at', opts.sentAt)}
      ${infoRow('Sender', `${BRAND_NAME} via Airo email gateway`)}
      ${infoRow('Operated by', BRAND_COMPANY)}
    </table>
    ${alertBox('If you received this email, delivery is working. Check your spam folder if it did not arrive in your inbox.', 'success')}
    ${p('To improve deliverability, ensure DKIM, SPF, and DMARC records are correctly configured for your sending domain.', C.muted, '13px')}
  `, 'Email delivery test from Profile Centre admin panel');

  const text = `Email delivery test — ${BRAND_NAME}\n\nThis is a test email to verify the email delivery pipeline.\n\nSent to: ${opts.recipientEmail}\nSent at: ${opts.sentAt}\nOperated by: ${BRAND_COMPANY}\n\nIf you received this, delivery is working correctly.${textFooter()}`;

  return { subject, html, text };
}
