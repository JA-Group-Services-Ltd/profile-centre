import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { MessageCircle, Save, Check, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NoProfilePrompt from '@/components/dashboard/NoProfilePrompt';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface ProfileRow {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
  whatsapp_url: string | null;
  whatsapp_label: string | null;
  whatsapp_enabled: number;
}

function profileLabel(p: ProfileRow): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const loadProfile = (p: ProfileRow) => {
    setProfile(p);
    setEnabled(!!p.whatsapp_enabled);
    setUrl(p.whatsapp_url || '');
    setLabel(p.whatsapp_label || '');
    setSaved(false);
    setError('');
  };

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.length > 0) {
          const profiles: ProfileRow[] = d.data;
          setAllProfiles(profiles);
          // Default to personal if available, otherwise use whichever profile exists (e.g. business-only users)
          const defaultProfile = profiles.find(x => x.profile_type !== 'business') ?? profiles[0];
          loadProfile(defaultProfile);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const switchProfile = (id: number) => {
    const p = allProfiles.find(x => x.id === id);
    if (p) loadProfile(p);
  };

  const handleSave = async () => {
    if (!profile) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          whatsapp_url: url.trim(),
          whatsapp_label: label.trim(),
          whatsapp_enabled: enabled ? 1 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Build a preview URL from a phone number input
  const formatWhatsAppUrl = (input: string) => {
    const stripped = input.replace(/\D/g, '');
    if (stripped.length >= 7) return `https://wa.me/${stripped}`;
    return input;
  };

  const isValidUrl = url.startsWith('https://wa.me/') || url.startsWith('https://api.whatsapp.com/');

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>WhatsApp Button — Dashboard</title>
        <meta name="description" content="Add a WhatsApp click-to-chat button to your public profile." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/whatsapp" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-400" /> WhatsApp Button
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add a WhatsApp click-to-chat button to your public profile so visitors can message you instantly.
          </p>
        </div>

        {/* Profile selector — always visible so users know which profile they're editing */}
        {allProfiles.length > 0 && (
          <div className="mb-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Managing WhatsApp button for:</p>
            <div className="flex flex-wrap gap-2">
              {allProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchProfile(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    profile?.id === p.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {profileLabel(p)}
                  <span className="ml-1.5 opacity-60">{p.profile_type === 'business' ? '· Business' : '· Personal'}</span>
                </button>
              ))}
            </div>
            {profile?.profile_type === 'business' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                You can also edit this from your{' '}
                <a href="/dashboard/business-profile" className="text-primary underline underline-offset-2 hover:no-underline">Business Profile page</a>
                {' '}— changes sync automatically, nothing is duplicated.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : !profile ? (
          <NoProfilePrompt featureName="WhatsApp button" preferredType="any" />
        ) : (
          <>
            {/* Enable toggle */}
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show WhatsApp button on profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, a green WhatsApp button appears on your public profile card.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Button settings</CardTitle>
                <CardDescription>Configure your WhatsApp link and button label.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-url">WhatsApp link <span className="text-destructive">*</span></Label>
                  <Input
                    id="wa-url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://wa.me/447700000000"
                    className="bg-background border-border font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: <code className="bg-muted px-1 rounded">https://wa.me/[country code][number]</code> — e.g. <code className="bg-muted px-1 rounded">https://wa.me/447700123456</code> for a UK number.
                  </p>
                  {url && !isValidUrl && (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <Info className="w-3 h-3" /> URL should start with https://wa.me/
                    </p>
                  )}
                  {url && isValidUrl && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green-400 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Test this link
                    </a>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wa-label">Button label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="wa-label"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Message me on WhatsApp"
                    maxLength={60}
                    className="bg-background border-border text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to use the default label.</p>
                </div>

                {/* Quick number helper */}
                <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-foreground">Quick link builder</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter phone number e.g. 447700123456"
                      className="bg-background border-border text-sm"
                      onChange={e => {
                        const formatted = formatWhatsAppUrl(e.target.value);
                        if (formatted.startsWith('https://')) setUrl(formatted);
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Type your number (with country code, no +) to auto-build the link above.</p>
                </div>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving || !url} className="gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save changes</>}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
