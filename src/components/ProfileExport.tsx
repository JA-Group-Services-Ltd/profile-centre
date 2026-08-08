/**
 * ProfileExport — export, social sharing and website embed tools.
 *
 * These controls are deliberately plan-neutral: Free and Starter customers can
 * share and embed their published profile, and higher plans inherit the same
 * capability. Paid-plan gates remain attached only to genuinely paid features.
 */
import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/date';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Facebook,
  FileDown,
  Ghost,
  Instagram,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Printer,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportProfile {
  display_name?: string;
  job_title?: string;
  company?: string;
  bio?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  profile_photo?: string;
  business_name?: string;
  business_tagline?: string;
  business_email?: string;
  business_phone?: string;
  business_website?: string;
  business_address?: string;
  business_description?: string;
  business_category?: string;
  logo_url?: string;
}

interface ProfileExportProps {
  profile: ExportProfile;
  profileUrl?: string;
  variant?: 'personal' | 'business';
}

type ShareTarget = 'instagram' | 'snapchat' | 'messenger';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normaliseWebUrl(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const candidate = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['http:', 'https:'].includes(candidate.protocol) ? candidate.toString() : '';
  } catch {
    return '';
  }
}

function safeImageUrl(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (raw.startsWith('data:image/')) return raw;
  return normaliseWebUrl(raw);
}

function buildHtml(profile: ExportProfile, profileUrl: string, variant: 'personal' | 'business'): string {
  const name = variant === 'business'
    ? (profile.business_name || profile.display_name || 'Profile')
    : (profile.display_name || 'Profile');
  const tagline = variant === 'business'
    ? (profile.business_tagline || profile.business_category || '')
    : (profile.job_title || profile.company || '');
  const email = String(variant === 'business' ? profile.business_email || '' : profile.email || '').trim();
  const phone = String(variant === 'business' ? profile.business_phone || '' : profile.phone || '').trim();
  const website = normaliseWebUrl(variant === 'business' ? profile.business_website : profile.website);
  const address = variant === 'business' ? profile.business_address : profile.address;
  const bio = variant === 'business' ? profile.business_description : profile.bio;
  const photo = safeImageUrl(variant === 'business' ? profile.logo_url : profile.profile_photo);
  const publicUrl = normaliseWebUrl(profileUrl);

  const contactRows = [
    email ? `<tr><td class="label">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>` : '',
    phone ? `<tr><td class="label">Phone</td><td><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : '',
    website ? `<tr><td class="label">Website</td><td><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a></td></tr>` : '',
    address ? `<tr><td class="label">Address</td><td>${escapeHtml(address)}</td></tr>` : '',
    publicUrl ? `<tr><td class="label">Profile</td><td><a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(publicUrl)}</a></td></tr>` : '',
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — Digital Profile</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px 20px; min-height: 100vh; }
    .card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 4px 32px rgba(0,0,0,.10); overflow: hidden; }
    .header { background: linear-gradient(135deg,#3B82F6 0%,#6366F1 100%); padding: 40px 32px 32px; display: flex; align-items: center; gap: 24px; }
    .avatar,.avatar-placeholder { width: 80px; height: 80px; border-radius: 16px; flex-shrink: 0; border: 3px solid rgba(255,255,255,.4); }
    .avatar { object-fit: cover; background: rgba(255,255,255,.2); }
    .avatar-placeholder { background: rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:700; color:#fff; }
    .header-text h1 { font-size: 26px; font-weight: 700; color: #fff; line-height:1.2; }
    .header-text p { font-size:14px; color:rgba(255,255,255,.82); margin-top:4px; }
    .body { padding:32px; }
    .bio { font-size:14px; color:#475569; line-height:1.7; margin-bottom:28px; padding:16px; background:#f8fafc; border-radius:12px; border-left:3px solid #3B82F6; white-space:pre-wrap; }
    table { width:100%; border-collapse:collapse; }
    tr { border-bottom:1px solid #f1f5f9; } tr:last-child { border-bottom:none; }
    td { padding:12px 8px; font-size:14px; vertical-align:top; }
    td.label { color:#64748b; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.05em; width:90px; padding-top:14px; }
    a { color:#2563eb; text-decoration:none; overflow-wrap:anywhere; }
    .footer { text-align:center; padding:20px 32px; border-top:1px solid #f1f5f9; font-size:11px; color:#64748b; }
    @media print { body { background:white; padding:0; } .card { box-shadow:none; border-radius:0; max-width:100%; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" class="avatar" />` : `<div class="avatar-placeholder">${escapeHtml(name.charAt(0).toUpperCase())}</div>`}
      <div class="header-text"><h1>${escapeHtml(name)}</h1>${tagline ? `<p>${escapeHtml(tagline)}</p>` : ''}</div>
    </div>
    <div class="body">
      ${bio ? `<div class="bio">${escapeHtml(bio)}</div>` : ''}
      ${contactRows ? `<table>${contactRows}</table>` : ''}
    </div>
    <div class="footer">Generated by Sousa Murray Profiles · ${escapeHtml(fmtDate(new Date(), 'long'))}</div>
  </div>
</body>
</html>`;
}

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export default function ProfileExport({ profile, profileUrl = '', variant = 'personal' }: ProfileExportProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [notice, setNotice] = useState('');
  const [embedOpen, setEmbedOpen] = useState(false);

  const publicUrl = useMemo(() => normaliseWebUrl(profileUrl), [profileUrl]);
  const displayName = variant === 'business'
    ? profile.business_name || profile.display_name || 'My profile'
    : profile.display_name || 'My profile';
  const shareText = `${displayName} on Sousa Murray Profiles`;
  const html = useMemo(() => buildHtml(profile, publicUrl, variant), [profile, publicUrl, variant]);
  const embedCode = useMemo(() => publicUrl ? `<iframe src="${publicUrl}" title="${displayName.replaceAll('"', '&quot;')} — Sousa Murray Profiles" loading="lazy" style="width:100%;min-height:720px;border:0;border-radius:16px" referrerpolicy="strict-origin-when-cross-origin"></iframe>` : '', [displayName, publicUrl]);

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  };

  const handleSaveHtml = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (profile.business_name || profile.display_name || 'profile').toLowerCase().replace(/\s+/g, '-');
    a.download = `${name}-card.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPrintWindow = (printImmediately: boolean) => {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) {
      announce('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      return false;
    }
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    win.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      if (printImmediately) win.print();
      setLoadingPdf(false);
    }, { once: true });
    win.focus();
    return true;
  };

  const handlePrint = () => openPrintWindow(true);
  const handleSavePdf = () => {
    setLoadingPdf(true);
    if (!openPrintWindow(true)) setLoadingPdf(false);
  };

  const nativeShare = async (targetLabel?: string) => {
    if (!publicUrl) return announce('Publish your profile first so it has a public link to share.');
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: publicUrl });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }
    const copied = await copyText(publicUrl);
    announce(copied
      ? `Profile link copied${targetLabel ? ` — paste it into ${targetLabel}` : ''}.`
      : 'Could not copy the link automatically. Select the profile URL and copy it manually.');
  };

  const shareFacebook = () => {
    if (!publicUrl) return announce('Publish your profile first so it has a public link to share.');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, '_blank', 'noopener,noreferrer,width=720,height=640');
  };

  const shareWhatsApp = () => {
    if (!publicUrl) return announce('Publish your profile first so it has a public link to share.');
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${publicUrl}`)}`, '_blank', 'noopener,noreferrer');
  };

  const shareApp = (target: ShareTarget) => {
    const labels: Record<ShareTarget, string> = { instagram: 'Instagram', snapchat: 'Snapchat', messenger: 'Messenger' };
    void nativeShare(labels[target]);
  };

  const copyLink = async () => {
    if (!publicUrl) return announce('Publish your profile first so it has a public link to copy.');
    announce(await copyText(publicUrl) ? 'Profile link copied.' : 'Could not copy the profile link automatically.');
  };

  const copyEmbed = async () => {
    if (!embedCode) return announce('Publish your profile first so an embed code can be created.');
    announce(await copyText(embedCode) ? 'Website embed code copied.' : 'Could not copy the embed code automatically.');
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Export</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSavePdf} disabled={loadingPdf} className="border-border gap-1.5 text-xs" title="Open the print dialog and choose Save as PDF">
            {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Save as PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveHtml} className="border-border gap-1.5 text-xs" title="Download a standalone HTML contact card">
            <Code2 className="w-3.5 h-3.5" /> Save as HTML
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="border-border gap-1.5 text-xs" title="Print your profile card">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Share your public profile</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Available on Free, Starter and all higher plans.</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => void nativeShare()}>
            <Share2 className="w-3.5 h-3.5" /> Share…
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={shareFacebook}><Facebook className="w-3.5 h-3.5" /> Facebook</Button>
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={() => shareApp('instagram')}><Instagram className="w-3.5 h-3.5" /> Instagram</Button>
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={() => shareApp('snapchat')}><Ghost className="w-3.5 h-3.5" /> Snapchat</Button>
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={shareWhatsApp}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</Button>
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={() => shareApp('messenger')}><MessagesSquare className="w-3.5 h-3.5" /> Messenger</Button>
          <Button type="button" variant="outline" size="sm" className="justify-start gap-1.5 text-xs" onClick={() => void copyLink()}><Copy className="w-3.5 h-3.5" /> Copy link</Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          Facebook and WhatsApp support direct web sharing. Instagram, Snapchat and Messenger use your device's share sheet where supported; otherwise the profile link is copied so you can paste it into the app.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <button type="button" onClick={() => setEmbedOpen(value => !value)} className="w-full flex items-center justify-between gap-3 text-left rounded-xl hover:bg-muted/40 p-2 -m-2 transition-colors">
          <div>
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5 text-primary" /> Embed on your website</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Copy an iframe snippet for WordPress, Squarespace, Wix or another website builder that accepts custom HTML.</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
        {embedOpen && (
          <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
            <textarea readOnly value={embedCode || 'Publish your profile first to create an embed code.'} className="w-full min-h-28 resize-y rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-foreground" aria-label="Profile website embed code" />
            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-muted-foreground">The embedded profile stays connected to your live profile, so future profile updates appear automatically.</p>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => void copyEmbed()} disabled={!embedCode}>
                <Copy className="w-3.5 h-3.5" /> Copy embed code
              </Button>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground" role="status" aria-live="polite">
          <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
