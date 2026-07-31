/**
 * ProfileExport — three export buttons: Save as PDF, Save as HTML, Print
 *
 * Works for both personal and business profiles.
 * Generates a clean, print-ready card layout from the profile data.
 */
import { useState } from 'react';
import { fmtDate } from '@/lib/date';
import { FileDown, Code2, Printer, Loader2 } from 'lucide-react';
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
  // Business fields
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

function buildHtml(profile: ExportProfile, profileUrl: string, variant: 'personal' | 'business'): string {
  const name = variant === 'business'
    ? (profile.business_name || profile.display_name || 'Profile')
    : (profile.display_name || 'Profile');
  const tagline = variant === 'business'
    ? (profile.business_tagline || profile.business_category || '')
    : (profile.job_title || profile.company || '');
  const email = variant === 'business' ? profile.business_email : profile.email;
  const phone = variant === 'business' ? profile.business_phone : profile.phone;
  const website = variant === 'business' ? profile.business_website : profile.website;
  const address = variant === 'business' ? profile.business_address : profile.address;
  const bio = variant === 'business' ? profile.business_description : profile.bio;
  const photo = variant === 'business' ? profile.logo_url : profile.profile_photo;

  const contactRows = [
    email    ? `<tr><td class="label">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>` : '',
    phone    ? `<tr><td class="label">Phone</td><td><a href="tel:${phone}">${phone}</a></td></tr>` : '',
    website  ? `<tr><td class="label">Website</td><td><a href="${website}" target="_blank">${website}</a></td></tr>` : '',
    address  ? `<tr><td class="label">Address</td><td>${address}</td></tr>` : '',
    profileUrl ? `<tr><td class="label">Profile</td><td><a href="${profileUrl}" target="_blank">${profileUrl}</a></td></tr>` : '',
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Digital Business Card</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 40px 20px;
      min-height: 100vh;
    }
    .card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
      padding: 40px 32px 32px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 16px;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.4);
      flex-shrink: 0;
      background: rgba(255,255,255,0.2);
    }
    .avatar-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 16px;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }
    .header-text h1 {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
    .header-text p {
      font-size: 14px;
      color: rgba(255,255,255,0.8);
      margin-top: 4px;
    }
    .body { padding: 32px; }
    .bio {
      font-size: 14px;
      color: #475569;
      line-height: 1.7;
      margin-bottom: 28px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
      border-left: 3px solid #3B82F6;
    }
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid #f1f5f9; }
    tr:last-child { border-bottom: none; }
    td { padding: 12px 8px; font-size: 14px; vertical-align: top; }
    td.label {
      color: #94a3b8;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      width: 90px;
      padding-top: 14px;
    }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer {
      text-align: center;
      padding: 20px 32px;
      border-top: 1px solid #f1f5f9;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { background: white; padding: 0; }
      .card { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${photo
        ? `<img src="${photo}" alt="${name}" class="avatar" />`
        : `<div class="avatar-placeholder">${name.charAt(0).toUpperCase()}</div>`
      }
      <div class="header-text">
        <h1>${name}</h1>
        ${tagline ? `<p>${tagline}</p>` : ''}
      </div>
    </div>
    <div class="body">
      ${bio ? `<div class="bio">${bio}</div>` : ''}
      ${contactRows ? `<table>${contactRows}</table>` : ''}
    </div>
    <div class="footer">
      Generated by Profile Centre · ${fmtDate(new Date(), 'long')}
    </div>
  </div>
</body>
</html>`;
}

export default function ProfileExport({ profile, profileUrl = '', variant = 'personal' }: ProfileExportProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);

  const html = buildHtml(profile, profileUrl, variant);

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

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    win.addEventListener('load', () => { URL.revokeObjectURL(url); win.print(); }, { once: true });
    win.focus();
  };

  const handleSavePdf = async () => {
    setLoadingPdf(true);
    try {
      // Open in new tab and trigger print-to-PDF
      const win = window.open('', '_blank', 'width=700,height=900');
      if (!win) { setLoadingPdf(false); return; }
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      win.location.href = url;
      win.addEventListener('load', () => {
        URL.revokeObjectURL(url);
        win.print();
        setLoadingPdf(false);
      }, { once: true });
      win.focus();
    } catch {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSavePdf}
        disabled={loadingPdf}
        className="border-border gap-1.5 text-xs"
        title="Save as PDF — your browser will open a print dialog; choose 'Save as PDF'"
      >
        {loadingPdf
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FileDown className="w-3.5 h-3.5" />
        }
        Save as PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveHtml}
        className="border-border gap-1.5 text-xs"
        title="Download as a standalone HTML file"
      >
        <Code2 className="w-3.5 h-3.5" />
        Save as HTML
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        className="border-border gap-1.5 text-xs"
        title="Print your profile card"
      >
        <Printer className="w-3.5 h-3.5" />
        Print
      </Button>
    </div>
  );
}
