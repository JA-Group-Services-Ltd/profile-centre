/**
 * Admin Email Status & Deliverability API
 *
 * GET  /api/admin/email/status      — DKIM/SPF/DMARC status + DNS records
 * POST /api/admin/email/test        — Send a test email to the admin address
 * POST /api/admin/email/recheck     — Re-run DNS checks and update cached status
 *
 * HOW AIRO EMAIL WORKS:
 * ─────────────────────
 * Email is sent via the Airo platform gateway (127.0.0.1:2525 loopback).
 * The gateway owns SMTP delivery and DKIM signing.
 *
 * The DKIM public key for your domain is provisioned by Airo when you
 * connect your custom domain in the GoDaddy Airo dashboard. It is NOT
 * published at airo._domainkey.airoapp.ai (that record does not exist
 * publicly). You must obtain the key from the Airo domain connection
 * flow and add it to IONOS DNS yourself.
 *
 * HOW TO GET THE DKIM KEY:
 * ─────────────────────────
 * 1. In GoDaddy Airo, go to Settings → Custom Domain (or the domain
 *    connection wizard for this app).
 * 2. Airo will show you the DNS records to add, including the DKIM TXT
 *    record with the full p= value specific to your app.
 * 3. Copy that p= value and add it to IONOS DNS as shown below.
 *
 * IONOS DNS — records for japrofilestudio.jagroupservices.co.uk:
 * ──────────────────────────────────────────────────────────────
 * IONOS manages the zone jagroupservices.co.uk. Enter only the prefix in
 * the "Subdomain" field — IONOS appends .jagroupservices.co.uk automatically.
 *
 *   SPF:   Subdomain = japrofilestudio          ← already live ✓
 *   DKIM:  Subdomain = airo._domainkey.japrofilestudio   ← missing, needs adding
 *   DMARC: Subdomain = _dmarc.japrofilestudio   ← exists but p=none, upgrade to p=quarantine
 *
 * DNS checks use Google DNS-over-HTTPS (dns.google) because the sandbox
 * blocks outbound UDP DNS. Results are cached in platform_settings for 10 min.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { getSecret } from '#airo/secrets';
import { sendEmail } from '../../lib/send-email.js';
import { testEmail, EMAIL_REPLY_TO } from '../../lib/email-templates.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const SENDING_DOMAIN = 'japrofilestudio.jagroupservices.co.uk';
const FROM_ADDRESS = 'noreply@japrofilestudio.jagroupservices.co.uk';
const REPLY_TO_ADDRESS = 'contact@jagroupservices.co.uk';
const DKIM_SELECTOR = 'airo';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── DNS via Google DoH (sandbox blocks UDP DNS) ───────────────────────────────

async function dohLookupTxt(name: string): Promise<string[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  const json = await res.json() as {
    Status: number;
    Answer?: { type: number; data: string }[];
  };
  if (json.Status !== 0) return []; // NXDOMAIN or SERVFAIL → no records
  return (json.Answer ?? [])
    .filter(a => a.type === 16) // TXT = type 16
    .map(a => a.data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')); // strip quotes & join chunks
}

// ── DNS check helpers ─────────────────────────────────────────────────────────

async function checkSpf(domain: string): Promise<{
  status: 'pass' | 'fail' | 'none' | 'error';
  record: string | null;
  detail: string;
}> {
  try {
    const records = await dohLookupTxt(domain);
    const spfRecord = records.find(r => r.startsWith('v=spf1'));
    if (!spfRecord) {
      return { status: 'none', record: null, detail: 'No SPF record found for this domain.' };
    }
    const isValid = spfRecord.includes('~all') || spfRecord.includes('-all') || spfRecord.includes('?all');
    return {
      status: isValid ? 'pass' : 'fail',
      record: spfRecord,
      detail: isValid
        ? 'SPF record found and appears valid.'
        : 'SPF record found but may not be correctly configured (missing ~all or -all).',
    };
  } catch (err: unknown) {
    return { status: 'error', record: null, detail: `DNS lookup error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function checkDkim(domain: string, selector: string): Promise<{
  status: 'pass' | 'fail' | 'none' | 'pending' | 'error';
  record: string | null;
  detail: string;
  dnsName: string;
}> {
  const dnsName = `${selector}._domainkey.${domain}`;
  try {
    const records = await dohLookupTxt(dnsName);
    const dkimRecord = records.find(r => r.includes('v=DKIM1') || r.includes('k=rsa') || r.includes('p='));
    if (!dkimRecord) {
      return {
        status: 'pending',
        record: null,
        detail: 'DKIM record not found. The record has not been added yet, or DNS propagation is still in progress (can take up to 48 hours).',
        dnsName,
      };
    }
    const hasPublicKey = dkimRecord.includes('p=') && !dkimRecord.includes('p=;') && !dkimRecord.match(/p=\s*[";]/);
    return {
      status: hasPublicKey ? 'pass' : 'fail',
      record: dkimRecord,
      detail: hasPublicKey
        ? 'DKIM record found with a valid public key.'
        : 'DKIM record found but public key appears empty or revoked.',
      dnsName,
    };
  } catch (err: unknown) {
    return { status: 'error', record: null, detail: `DNS lookup error: ${err instanceof Error ? err.message : String(err)}`, dnsName };
  }
}

async function checkDmarc(domain: string): Promise<{
  status: 'pass' | 'fail' | 'none' | 'error';
  record: string | null;
  detail: string;
  policy: string | null;
}> {
  const dnsName = `_dmarc.${domain}`;
  try {
    const records = await dohLookupTxt(dnsName);
    const dmarcRecord = records.find(r => r.startsWith('v=DMARC1'));
    if (!dmarcRecord) {
      return { status: 'none', record: null, detail: 'No DMARC record found.', policy: null };
    }
    const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/i);
    const policy = policyMatch ? policyMatch[1].toLowerCase() : null;
    const isStrong = policy === 'quarantine' || policy === 'reject';
    return {
      status: 'pass',
      record: dmarcRecord,
      detail: isStrong
        ? `DMARC record found with policy: ${policy}. Good deliverability protection.`
        : `DMARC record found with policy: ${policy ?? 'unknown'}. Consider upgrading to quarantine or reject for better protection.`,
      policy,
    };
  } catch (err: unknown) {
    return { status: 'error', record: null, detail: `DNS lookup error: ${err instanceof Error ? err.message : String(err)}`, policy: null };
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function getCachedStatus(): { data: unknown; checkedAt: string } | null {
  try {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'email_auth_status'").get() as { value: string } | undefined;
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as { data: unknown; checkedAt: string; expiresAt: number };
    if (Date.now() > parsed.expiresAt) return null;
    return { data: parsed.data, checkedAt: parsed.checkedAt };
  } catch {
    return null;
  }
}

function setCachedStatus(data: unknown): void {
  try {
    const value = JSON.stringify({
      data,
      checkedAt: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    const existing = db.prepare("SELECT key FROM platform_settings WHERE key = 'email_auth_status'").get();
    if (existing) {
      db.prepare("UPDATE platform_settings SET value = ? WHERE key = 'email_auth_status'").run(value);
    } else {
      db.prepare("INSERT INTO platform_settings (key, value) VALUES ('email_auth_status', ?)").run(value);
    }
  } catch {
    // Non-fatal
  }
}

// ── Run all DNS checks ────────────────────────────────────────────────────────

async function runChecks() {
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(SENDING_DOMAIN),
    checkDkim(SENDING_DOMAIN, DKIM_SELECTOR),
    checkDmarc(SENDING_DOMAIN),
  ]);

  // IONOS note: zone = jagroupservices.co.uk — enter only the prefix in the Subdomain field.
  const requiredRecords = [
    {
      type: 'TXT',
      name: `${DKIM_SELECTOR}._domainkey.${SENDING_DOMAIN}`,
      ionosSubdomain: `${DKIM_SELECTOR}._domainkey.japrofilestudio`,
      value: `v=DKIM1; k=rsa; p=<YOUR_AIRO_DKIM_PUBLIC_KEY>`,
      ttl: 3600,
      purpose: 'DKIM — allows receiving servers to verify emails were signed by Airo on behalf of this domain',
      status: dkim.status,
      keyAvailable: false,
      note: [
        'IONOS Subdomain field: airo._domainkey.japrofilestudio',
        '(IONOS appends .jagroupservices.co.uk automatically — do not include it)',
        '',
        'How to get the p= value:',
        '  1. In GoDaddy Airo, go to Settings → Custom Domain for this app.',
        '  2. Airo shows the DNS records to add — copy the full DKIM TXT record value (v=DKIM1; k=rsa; p=...).',
        '  3. The key is unique to your app — it cannot be looked up from airoapp.ai.',
        '',
        'Full DNS name (for verification): airo._domainkey.japrofilestudio.jagroupservices.co.uk',
      ].join('\n'),
    },
    {
      type: 'TXT',
      name: SENDING_DOMAIN,
      ionosSubdomain: 'japrofilestudio',
      value: `v=spf1 include:_spf.airoapp.ai ~all`,
      ttl: 3600,
      purpose: 'SPF — authorises the Airo gateway to send email on behalf of this domain',
      status: spf.status,
      note: [
        'IONOS Subdomain field: japrofilestudio',
        '',
        'This record is already live. If you need to update it, edit the existing',
        'TXT record rather than adding a new one — only one SPF record is allowed per hostname.',
      ].join('\n'),
    },
    {
      type: 'TXT',
      name: `_dmarc.${SENDING_DOMAIN}`,
      ionosSubdomain: '_dmarc.japrofilestudio',
      value: `v=DMARC1; p=quarantine; rua=mailto:${FROM_ADDRESS}; ruf=mailto:${FROM_ADDRESS}; fo=1`,
      ttl: 3600,
      purpose: 'DMARC — tells receiving servers what to do with emails that fail SPF/DKIM checks',
      status: dmarc.status,
      note: [
        'IONOS Subdomain field: _dmarc.japrofilestudio',
        '',
        'A DMARC record exists but with p=none (monitor only — no enforcement).',
        'Update it to p=quarantine or p=reject once DKIM is passing to get full protection.',
        'Edit the existing record in IONOS rather than adding a new one.',
      ].join('\n'),
    },
  ];

  return {
    domain: SENDING_DOMAIN,
    fromAddress: FROM_ADDRESS,
    replyToAddress: REPLY_TO_ADDRESS,
    dkimSelector: DKIM_SELECTOR,
    spf,
    dkim,
    dmarc,
    requiredRecords,
    dkimKeyUnavailable: dkim.status !== 'pass',
    dkimKeyInstructions: {
      summary: 'The Airo DKIM public key is unique to your app and is provided by the Airo platform when you connect your custom domain.',
      steps: [
        '1. In GoDaddy Airo, go to Settings → Custom Domain (or the domain connection wizard for this app).',
        '2. Airo will display the DNS records you need to add — including the DKIM TXT record with the full v=DKIM1; k=rsa; p=... value.',
        '3. Log in to IONOS → Domains & SSL → jagroupservices.co.uk → DNS.',
        '4. Add a new TXT record:',
        '     Subdomain: airo._domainkey.japrofilestudio',
        '     Value:     v=DKIM1; k=rsa; p=<the key from Airo>',
        '     TTL:       3600',
        '   (IONOS appends .jagroupservices.co.uk automatically.)',
        '5. Click Re-check DNS here to confirm the record is live.',
      ],
    },
    overallStatus: (
      dkim.status === 'pass' && spf.status === 'pass' && dmarc.status === 'pass'
        ? 'healthy'
        : dkim.status === 'pending' || dkim.status === 'none' || spf.status === 'none' || dmarc.status === 'none'
        ? 'action_required'
        : 'degraded'
    ) as 'healthy' | 'action_required' | 'degraded',
    deliverabilityTips: [
      dkim.status !== 'pass' && 'DKIM missing: Get the DKIM public key from GoDaddy Airo → Settings → Custom Domain, then add it in IONOS DNS with Subdomain = airo._domainkey.japrofilestudio.',
      spf.status !== 'pass' && 'SPF: In IONOS DNS, add or update a TXT record with Subdomain = japrofilestudio and Value = v=spf1 include:_spf.airoapp.ai ~all.',
      dmarc.status === 'none' && 'DMARC missing: In IONOS DNS, add a TXT record with Subdomain = _dmarc.japrofilestudio.',
      dmarc.status === 'pass' && dmarc.policy === 'none' && 'DMARC policy is "none" (monitor only). Update it to p=quarantine or p=reject once DKIM is passing.',
    ].filter(Boolean) as string[],
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function getEmailStatus(req: Request, res: Response) {
  try {
    const forceRefresh = req.query.refresh === '1';
    if (!forceRefresh) {
      const cached = getCachedStatus();
      if (cached) {
        return res.json({ success: true, data: cached.data, checkedAt: cached.checkedAt, fromCache: true });
      }
    }

    const data = await runChecks();
    const checkedAt = new Date().toISOString();
    setCachedStatus(data);

    return res.json({ success: true, data, checkedAt, fromCache: false });
  } catch (err) {
    console.error('[email-status] check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check email authentication status.' });
  }
}

export async function recheckEmailStatus(req: Request, res: Response) {
  try {
    const data = await runChecks();
    const checkedAt = new Date().toISOString();
    setCachedStatus(data);
    return res.json({ success: true, data, checkedAt, fromCache: false });
  } catch (err) {
    console.error('[email-status] recheck error:', err);
    return res.status(500).json({ success: false, error: 'Failed to re-check email authentication status.' });
  }
}

export async function sendTestEmail(req: Request, res: Response) {
  try {
    const adminAddr = (() => {
      try {
        const v = getSecret('ADMIN_NOTIFICATION_EMAIL');
        return typeof v === 'string' && v.includes('@') ? v : null;
      } catch { return null; }
    })();

    const recipientEmail = (req.body?.email as string | undefined) || adminAddr;
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'No recipient email address. Configure ADMIN_NOTIFICATION_EMAIL or provide an email in the request body.',
      });
    }

    const sentAt = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'medium' });
    const { subject, html, text } = testEmail({ recipientEmail, sentAt });

    const result = await sendEmail({ fromName: 'Sousa Murray Profiles', to: recipientEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });

    return res.json({
      success: true,
      message: `Test email sent to ${recipientEmail}. Check your inbox (and spam folder).`,
      sentTo: recipientEmail,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[email-status] test email error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test email.',
    });
  }
}
