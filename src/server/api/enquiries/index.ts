import { type Request, type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { isValidEmail } from '../../../lib/validate-email.js';
import { notifyEnquiryReceived, notifyEnquiryConfirmation } from '../../lib/notifications.js';

// ── Rate limiting: in-memory store ────────────────────────────────────────────
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 3;
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// ── Content moderation: detect obvious spam/abuse patterns ───────────────────
const SPAM_PATTERNS = [
  /\b(viagra|cialis|casino|lottery|winner|prize|click here|free money|make money fast|work from home|earn \$|bitcoin|crypto investment|OnlyFans|adult content)\b/i,
  /https?:\/\/[^\s]{3,}/g,   // URLs in message body
  /(.)\1{8,}/,               // Repeated characters (e.g. "aaaaaaaaaa")
];

function detectSpam(text: string): { isSpam: boolean; reason: string } {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { isSpam: true, reason: `Matched spam pattern: ${pattern.toString().slice(0, 40)}` };
    }
  }
  // Excessive links
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount >= 2) return { isSpam: true, reason: `Contains ${urlCount} URLs` };
  return { isSpam: false, reason: '' };
}

// ── Flag enquiry to admin issue-reports table ─────────────────────────────────
async function flagEnquiryAsAbuse(profileId: number, enquiryId: number, senderName: string, senderEmail: string, message: string, reason: string) {
  try {
    await db.prepare(`
      INSERT INTO visitor_reports (profile_id, reported_user_id, category, details, reporter_name, reporter_email, good_faith_confirmed, status)
      VALUES (?, NULL, 'spam_scam', ?, ?, ?, 1, 'pending')
    `).run(
      profileId,
      `[AUTO-FLAGGED ENQUIRY #${enquiryId}] ${reason}\n\nSender: ${senderName} <${senderEmail}>\n\nMessage:\n${message.slice(0, 500)}`,
      'System (auto-moderation)',
      'system@japrofilestudio.jagroupservices.co.uk',
    );
  } catch {
    // Non-fatal — enquiry is still saved
  }
}

// ── VPN / proxy detection ─────────────────────────────────────────────────────
// Heuristic only — not a guarantee. Flags common datacenter/proxy signals.
function detectVpnSignals(ip: string, userAgent: string): { isVpn: boolean; detail: string } {
  const signals: string[] = [];

  // Known datacenter / hosting CIDR prefixes (IPv4 only, common ranges)
  const datacenterPrefixes = [
    '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
    '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
    '172.30.', '172.31.',
    // Common VPS/cloud ranges
    '104.21.', '104.22.', '104.16.', '104.17.', '104.18.', '104.19.', '104.20.',
    '198.41.', '162.158.', '172.64.', '172.65.', '172.66.', '172.67.',
    '141.101.', '108.162.',
  ];
  if (datacenterPrefixes.some(p => ip.startsWith(p))) {
    signals.push('datacenter/CDN IP range');
  }

  // Tor exit node heuristic — .onion-routed traffic arrives via exit nodes
  // We can't detect Tor definitively without a live list, but flag ::1/loopback
  if (ip === '::1' || ip === '127.0.0.1') {
    signals.push('loopback address');
  }

  // Headless / bot user agents
  const headlessPatterns = [
    /headlesschrome/i, /phantomjs/i, /selenium/i, /webdriver/i,
    /puppeteer/i, /playwright/i, /python-requests/i, /curl\//i,
    /wget\//i, /go-http-client/i, /java\//i, /okhttp/i,
  ];
  if (!userAgent || userAgent.trim().length < 10) {
    signals.push('missing or very short user-agent');
  } else if (headlessPatterns.some(p => p.test(userAgent))) {
    signals.push('headless/automated user-agent');
  }

  const isVpn = signals.length > 0;
  return { isVpn, detail: isVpn ? signals.join('; ') : '' };
}
export async function submitEnquiry(req: Request, res: Response) {
  try {
    const { username } = req.params;
    const { sender_name, sender_email, message, _hp } = req.body;

    // ── Honeypot check: bots fill hidden fields, humans don't ─────────────────
    if (_hp && String(_hp).trim().length > 0) {
      // Silently accept to not reveal detection
      return res.status(201).json({ success: true, message: 'Message sent successfully' });
    }

    if (!sender_name || !sender_email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required' });
    }
    if (String(sender_name).trim().length < 2 || String(sender_name).trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Name must be between 2 and 100 characters' });
    }
    if (!isValidEmail(sender_email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (String(message).trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Message is too short (minimum 10 characters)' });
    }
    if (String(message).length > 2000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 2000 characters)' });
    }

    const ip = (
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.headers['x-real-ip']?.toString().trim() ||
      req.ip ||
      'unknown'
    );
    const userAgent = req.headers['user-agent'] || '';

    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again later.' });
    }

    const vpn = detectVpnSignals(ip, userAgent);

    const profile = await db.prepare(
      'SELECT id, user_id, enquiry_enabled FROM profiles WHERE (username = ? OR biz_slug = ?) AND is_published = 1'
    ).get(username, username) as { id: number; user_id: number; enquiry_enabled: number } | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Respect the profile owner's enquiry toggle
    if (profile.enquiry_enabled === 0) {
      return res.status(403).json({ success: false, error: 'Enquiries are currently disabled for this profile' });
    }

    // Check if plan has contact form
    const user = await db.prepare('SELECT plan_id FROM users WHERE id = ?').get(profile.user_id) as { plan_id: number } | undefined;
    const plan = user ? await db.prepare('SELECT has_contact_form FROM plans WHERE id = ?').get(user.plan_id) as { has_contact_form: number } | undefined : undefined;
    if (!plan?.has_contact_form) {
      return res.status(403).json({ success: false, error: 'Contact form not available for this profile' });
    }

    const cleanName = String(sender_name).trim();
    const cleanEmail = String(sender_email).toLowerCase().trim();
    const cleanMessage = String(message).trim();

    const result = await db.prepare(
      `INSERT INTO contact_enquiries
         (profile_id, sender_name, sender_email, message, sender_ip, sender_user_agent, is_vpn, vpn_check_detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(profile.id, cleanName, cleanEmail, cleanMessage, ip, userAgent, vpn.isVpn ? 1 : 0, vpn.detail || null);

    const enquiryId = result.lastInsertRowid as number;

    // ── Spam detection: auto-flag suspicious content to admin ─────────────────
    const spamCheck = detectSpam(cleanMessage + ' ' + cleanName);
    if (spamCheck.isSpam) {
      await flagEnquiryAsAbuse(profile.id, enquiryId, cleanName, cleanEmail, cleanMessage, spamCheck.reason);
    }

    // ── Notify the profile owner by email ─────────────────────────────────────
    try {
      const owner = await db.prepare(
        `SELECT u.email, u.name, u.preferences, p.display_name, p.business_name
         FROM users u JOIN profiles p ON p.user_id = u.id
         WHERE p.id = ?`
      ).get(profile.id) as { email: string; name: string; preferences: string | null; display_name: string; business_name: string | null } | undefined;

      if (owner) {
        const prefs = owner.preferences ? JSON.parse(owner.preferences) : {};
        const emailEnabled = prefs.email_notifications_enabled !== false;
        const enquiryEnabled = prefs.email_on_new_enquiry !== false;
        const profileName = owner.business_name || owner.display_name || 'your profile';
        if (emailEnabled && enquiryEnabled) {
          notifyEnquiryReceived({
            ownerEmail: owner.email,
            ownerName: owner.name,
            senderName: cleanName,
            senderEmail: cleanEmail,
            message: cleanMessage,
            profileName,
          });
        }
        // Always send confirmation to the sender
        notifyEnquiryConfirmation({
          senderEmail: cleanEmail,
          senderName: cleanName,
          recipientProfileName: profileName,
          messagePreview: cleanMessage,
        });
      }
    } catch {
      // Non-fatal
    }

    res.status(201).json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

// GET /api/enquiries
export async function getEnquiries(req: AuthRequest, res: Response) {
  try {
    const profiles = await db.prepare('SELECT id FROM profiles WHERE user_id = ?').all(req.user!.id) as { id: number }[];
    if (profiles.length === 0) return res.json({ success: true, data: [] });

    const profileIds = profiles.map(p => p.id);
    const placeholders = profileIds.map(() => '?').join(',');
    const enquiries = await db.prepare(
      `SELECT ce.*, p.username, p.display_name as profile_name FROM contact_enquiries ce 
       JOIN profiles p ON ce.profile_id = p.id 
       WHERE ce.profile_id IN (${placeholders}) ORDER BY ce.created_at DESC`
    ).all(...profileIds);

    res.json({ success: true, data: enquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
  }
}

// PUT /api/enquiries/:id/read
export async function markRead(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const enquiry = await db.prepare(
      'SELECT ce.* FROM contact_enquiries ce JOIN profiles p ON ce.profile_id = p.id WHERE ce.id = ? AND p.user_id = ?'
    ).get(id, req.user!.id);
    if (!enquiry) return res.status(404).json({ success: false, error: 'Enquiry not found' });
    await db.prepare('UPDATE contact_enquiries SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
}
