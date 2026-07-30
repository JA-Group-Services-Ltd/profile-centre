import { useState, useEffect } from 'react';
import { Download, Copy, Check, QrCode, User, Building2, Lock, FileText } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface ProfileEntry {
  id: number;
  username: string;
  profile_type: string;
  biz_slug?: string;
  person_slug?: string;
  display_name?: string;
  business_name?: string;
}

interface QrEntry {
  profile: ProfileEntry;
  qr_data_url: string;
  profile_url: string;
  label: string;
  type: 'personal' | 'business' | 'business_person';
}

export default function QRCodePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<QrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  // Entitlement — derived directly from auth context (single source of truth)
  const hasPaidAccess = !!(
    user?.hasBusinessAccess ||
    user?.hasStarterAccess ||
    user?.hasLifetimeAccess ||
    user?.trialActive
  );
  const hasBusinessAccess = !!(user?.hasBusinessAccess || user?.hasLifetimeAccess);
  // QR PNG download requires Starter or higher (not trial-only)
  const hasQrDownload = !!(user?.hasBusinessAccess || user?.hasStarterAccess || user?.hasLifetimeAccess);

  useEffect(() => {
    async function load() {
      const profilesRes = await fetch('/api/profiles/me', { credentials: 'include' });
      const profilesData = await profilesRes.json();

      const results: QrEntry[] = [];

      // Own profiles
      if (profilesData.success && profilesData.data?.length) {
        const profiles: ProfileEntry[] = profilesData.data;

        for (const p of profiles) {
          // Business QR requires Business plan
          if (p.profile_type === 'business' && !hasBusinessAccess) continue;
          // Personal QR requires at least Starter plan
          if (!hasPaidAccess) continue;

          const qrRes = await fetch(`/api/qr/${p.id}`, { credentials: 'include' });
          const qrData = await qrRes.json();
          if (!qrData.success) continue;

          if (p.profile_type === 'business') {
            // Business landing page QR
            results.push({
              profile: p,
              qr_data_url: qrData.data.qr_data_url,
              profile_url: qrData.data.profile_url,
              label: p.business_name || p.display_name || 'Business Page',
              type: 'business',
            });

            // Person card QR — /profile/:bizSlug/:personSlug
            if (p.person_slug && p.biz_slug) {
              const personQrRes = await fetch(`/api/qr/${p.id}/person`, { credentials: 'include' });
              const personQrData = await personQrRes.json();
              if (personQrData.success) {
                results.push({
                  profile: p,
                  qr_data_url: personQrData.data.qr_data_url,
                  profile_url: personQrData.data.profile_url,
                  label: `${p.display_name || 'Person Card'} (Business Card)`,
                  type: 'business_person',
                });
              }
            }
          } else {
            results.push({
              profile: p,
              qr_data_url: qrData.data.qr_data_url,
              profile_url: qrData.data.profile_url,
              label: p.display_name || p.username || 'Personal Profile',
              type: 'personal',
            });
          }
        }
      }

      setEntries(results);
      setLoading(false);
    }
    load();
  }, [hasPaidAccess, hasBusinessAccess]);

  const copyLink = async (url: string, idx: number) => {
    await navigator.clipboard.writeText(url);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadQR = (entry: QrEntry) => {
    const a = document.createElement('a');
    a.href = entry.qr_data_url;
    const slug = entry.profile.biz_slug || entry.profile.username || 'profile';
    a.download = `${slug}-${entry.type}-qr-code.png`;
    a.click();
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Skeleton className="h-8 w-48 mb-8" />
      <div className="space-y-4">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );

  // Free users — show upgrade wall
  if (!hasPaidAccess) return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>QR Codes — JA Profile Studio</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">QR Codes</h1>
        <p className="text-muted-foreground mt-1">Share your profiles with QR codes</p>
      </div>
      <Card className="bg-card border-border">
        <CardContent className="py-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">QR codes require a paid plan</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Upgrade to Starter or higher to generate QR codes for your profiles and share them instantly.
            </p>
          </div>
          <Link to="/dashboard/billing">
            <Button className="bg-primary hover:bg-primary/90 mt-2">View Plans &amp; Upgrade</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>QR Codes — JA Profile Studio</title>
        <meta name="description" content="Generate and download QR codes for your profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/qr-code" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">QR Codes</h1>
        <p className="text-muted-foreground mt-1">Share your profiles with QR codes — one for each profile URL</p>
      </div>

      {entries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Create a profile first to generate your QR codes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {entries.map((entry, idx) => (
            <Card key={idx} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  {entry.type === 'personal' ? (
                    <User className="w-4 h-4 text-primary" />
                  ) : (
                    <Building2 className="w-4 h-4 text-primary" />
                  )}
                  <CardTitle className="text-base">{entry.label}</CardTitle>
                  <Badge className={`text-xs border-0 ml-auto ${
                    entry.type === 'personal'
                      ? 'bg-blue-500/10 text-blue-400'
                      : entry.type === 'business'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {entry.type === 'personal' ? 'Personal' : entry.type === 'business' ? 'Business Page' : 'Business Card'}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs break-all">{entry.profile_url}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <div className="p-4 bg-white rounded-2xl shadow-lg">
                  <img src={entry.qr_data_url} alt={`QR code for ${entry.label}`} className="w-56 h-56" />
                </div>

                <div className="flex gap-3 w-full">
                  <Button onClick={() => copyLink(entry.profile_url, idx)} variant="outline" className="flex-1 border-border gap-2">
                    {copied === idx
                      ? <><Check className="w-4 h-4 text-green-400" /> Copied!</>
                      : <><Copy className="w-4 h-4" /> Copy Link</>}
                  </Button>
                  {hasQrDownload ? (
                    <Button onClick={() => downloadQR(entry)} className="flex-1 bg-primary gap-2">
                      <Download className="w-4 h-4" /> Download PNG
                    </Button>
                  ) : (
                    <Button disabled className="flex-1 gap-2 opacity-50">
                      <Download className="w-4 h-4" /> Download PNG
                    </Button>
                  )}
                </div>

                {/* PDF Business Card Templates */}
              </CardContent>
            </Card>
          ))}

          {!hasQrDownload && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">PNG download requires an upgrade</p>
                  <p className="text-xs text-muted-foreground">Upgrade your plan to download QR codes as PNG files to print on business cards and flyers.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">How to use your QR codes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                'Print them on your physical business cards',
                'Add them to your email signature',
                'Display them at events and conferences',
                'Include them in presentations and proposals',
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-bold">{i + 1}</span>
                  </div>
                  {tip}
                </div>
              ))}
              <div className="pt-2 border-t border-border mt-2">
                <p className="text-xs text-muted-foreground mb-2">Want a shareable A4 PDF of your profile?</p>
                <Link to="/dashboard/poster">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    Profile Poster PDF
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
