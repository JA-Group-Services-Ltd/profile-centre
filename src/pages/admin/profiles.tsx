/**
 * Admin — Profiles Management
 * /admin/profiles
 *
 * Full control over all personal and business profiles.
 * Search, filter, edit, publish/unpublish, verify/unverify,
 * view linked messages/enquiries/domains, open owner in CRM.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  BadgeCheck, ShieldOff, Loader2, Clock, Search, RefreshCw,
  ExternalLink, User, Globe, Eye, ArrowLeft,
  Mail, Link2, Edit2, Check, Building2,
  QrCode, UserSearch, AlertTriangle, X, Trash2, Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import PinChallenge from '@/components/admin/PinChallenge';

// ── Types ─────────────────────────────────────────────────────────────────

interface Profile {
  id: number;
  username: string;
  display_name: string;
  user_id: number;
  user_email: string;
  user_name: string;
  is_published: number;
  is_verified: number;
  verified_at: string | null;
  verified_by: string | null;
  view_count: number;
  link_count: number;
  created_at: string;
  profile_type: string;
  biz_slug: string | null;
  person_slug: string | null;
  business_name: string | null;
  bio: string | null;
  job_title: string | null;
  company: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  seo_title: string | null;
  seo_description: string | null;
  verification_requested_at: string | null;
  verification_request_note: string | null;
  enquiry_count: number;
  message_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getProfilePath(p: Profile): string {
  if (p.profile_type === 'business' && p.biz_slug) return `/profile/${p.biz_slug}`;
  return `/profile/${p.username}`;
}


// ── Profile Edit Panel ────────────────────────────────────────────────────

interface EditField { key: string; label: string; type?: 'text' | 'textarea' | 'toggle'; }

const PERSONAL_FIELDS: EditField[] = [
  { key: 'display_name', label: 'Display Name' },
  { key: 'username', label: 'Username / Slug' },
  { key: 'bio', label: 'Bio', type: 'textarea' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'company', label: 'Company' },
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'seo_title', label: 'SEO Title' },
  { key: 'seo_description', label: 'SEO Description', type: 'textarea' },
];

const BUSINESS_FIELDS: EditField[] = [
  { key: 'business_name', label: 'Business Name' },
  { key: 'biz_slug', label: 'Business Slug' },
  { key: 'display_name', label: 'Display Name' },
  { key: 'bio', label: 'Description / Tagline', type: 'textarea' },
  { key: 'contact_email', label: 'Business Email' },
  { key: 'phone', label: 'Business Phone' },
  { key: 'website', label: 'Business Website' },
  { key: 'address', label: 'Business Address', type: 'textarea' },
  { key: 'seo_title', label: 'SEO Title' },
  { key: 'seo_description', label: 'SEO Description', type: 'textarea' },
];

function ProfileEditPanel({
  profile,
  onClose,
  onSaved,
  onDeleted,
  onOpenCRM,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (updated: Profile) => void;
  onDeleted: (id: number) => void;
  onOpenCRM: (userId: number) => void;
}) {
  const fields = profile.profile_type === 'business' ? BUSINESS_FIELDS : PERSONAL_FIELDS;
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = (profile as unknown as Record<string, string>)[f.key] ?? ''; });
    return init;
  });
  const [isPublished, setIsPublished] = useState(!!profile.is_published);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeletePin, setShowDeletePin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, is_published: isPublished ? 1 : 0 }),
      });
      const d = await res.json();
      if (d.success) {
        onSaved({ ...profile, ...form, is_published: isPublished ? 1 : 0 });
      } else {
        setError(d.error ?? 'Save failed');
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const executeDelete = async (token: string) => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'delete_profile' },
      });
      const d = await res.json();
      if (d.success) {
        onDeleted(profile.id);
      } else {
        setDeleteError(d.error ?? 'Delete failed');
      }
    } catch (e) {
      setDeleteError(String(e));
    }
    setDeleting(false);
  };

  const profilePath = getProfilePath(profile);

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to profiles
        </Button>
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {profile.profile_type === 'business' ? <Building2 className="w-6 h-6" /> : (profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.display_name || profile.username}</h2>
              <p className="text-sm text-muted-foreground font-mono">{profilePath}</p>
            </div>
            <div className="flex gap-2 ml-auto flex-wrap">
              <Badge className={`text-xs border-0 ${profile.profile_type === 'business' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                {profile.profile_type === 'business' ? 'Business' : 'Personal'}
              </Badge>
              {!!profile.is_verified && <Badge className="text-xs border-0 bg-green-500/10 text-green-400"><BadgeCheck className="w-3 h-3 mr-1" />Verified</Badge>}
              {profile.is_published ? (
                <a href={profilePath} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-border gap-1.5 h-7 text-xs">
                    <ExternalLink className="w-3 h-3" /> View Live
                  </Button>
                </a>
              ) : (
                <Link to={`/admin/profile-preview/${profile.id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 h-7 text-xs">
                    <Eye className="w-3 h-3" /> Admin Preview
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="outline" className="border-border gap-1.5 h-7 text-xs" onClick={() => onOpenCRM(profile.user_id)}>
                <UserSearch className="w-3 h-3" /> Open in CRM
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Views', value: profile.view_count, icon: Eye },
          { label: 'Links', value: profile.link_count, icon: Link2 },
          { label: 'Enquiries', value: profile.enquiry_count, icon: Mail },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="details">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="details">Profile Details</TabsTrigger>
          <TabsTrigger value="status">Status & Visibility</TabsTrigger>
          <TabsTrigger value="info">Owner Info</TabsTrigger>
          <TabsTrigger value="danger" className="text-red-400 data-[state=active]:text-red-400">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm">Edit Profile Fields</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {fields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      value={form[f.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="bg-background border-border text-sm resize-none"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={form[f.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="bg-background border-border text-sm"
                    />
                  )}
                </div>
              ))}
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button onClick={save} disabled={saving} className="bg-primary gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm">Visibility & Verification</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Published</p>
                  <p className="text-xs text-muted-foreground">Profile is visible to the public at {profilePath}</p>
                </div>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Verified</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.is_verified
                      ? `Verified${profile.verified_by ? ` by ${profile.verified_by}` : ''}${profile.verified_at ? ` on ${fmtDate(profile.verified_at)}` : ''}`
                      : profile.verification_requested_at
                        ? `Requested ${fmtDate(profile.verification_requested_at)}${profile.verification_request_note ? ` — "${profile.verification_request_note}"` : ''}`
                        : 'Not verified'}
                  </p>
                </div>
                <VerifyToggle profile={profile} />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button onClick={save} disabled={saving} className="bg-primary gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save Status'}
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">QR Code URL</p>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-mono text-foreground break-all">
                  {`https://japrofilestudio.jagroupservices.co.uk${profilePath}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm">Profile Owner</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: User, label: 'Name', value: profile.user_name },
                { icon: Mail, label: 'Email', value: profile.user_email },
                { icon: Globe, label: 'Profile URL', value: `https://japrofilestudio.jagroupservices.co.uk${profilePath}` },
                { icon: Clock, label: 'Created', value: fmtDate(profile.created_at) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-20">{label}</span>
                  <span className="text-sm text-foreground break-all">{value}</span>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="border-border gap-1.5 mt-2"
                onClick={() => onOpenCRM(profile.user_id)}
              >
                <UserSearch className="w-3.5 h-3.5" /> Open Owner in CRM
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="space-y-4 mt-4">
          <Card className="bg-card border-red-500/20">
            <CardHeader><CardTitle className="text-sm text-red-400">Danger Zone</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-sm font-medium text-foreground mb-1">Delete this profile permanently</p>
                <p className="text-xs text-muted-foreground mb-3">
                  This will permanently delete the {profile.profile_type} profile <strong className="text-foreground">{profile.display_name || profile.username}</strong> and all its links, enquiries, and related data. This cannot be undone.
                </p>
                {deleteError && (
                  <p className="text-xs text-red-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {deleteError}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5"
                  onClick={() => setShowDeletePin(true)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? 'Deleting…' : 'Delete Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PinChallenge
        open={showDeletePin}
        action="delete_profile"
        actionLabel={`permanently delete the profile "${profile.display_name || profile.username}"`}
        onSuccess={token => { setShowDeletePin(false); executeDelete(token); }}
        onCancel={() => setShowDeletePin(false)}
      />
    </div>
  );
}

// ── Verify toggle (standalone so it can call its own API) ─────────────────

function VerifyToggle({ profile }: { profile: Profile }) {
  const [verified, setVerified] = useState(!!profile.is_verified);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const method = verified ? 'DELETE' : 'POST';
    const res = await fetch(`/api/admin/profiles/${profile.id}/verify`, { method, credentials: 'include' });
    const d = await res.json();
    if (d.success) setVerified(!verified);
    setLoading(false);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className={`border-border gap-1.5 ${verified ? 'text-green-600 border-green-500/30' : 'text-muted-foreground'}`}
      onClick={toggle}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : verified ? <BadgeCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
      {verified ? 'Verified' : 'Unverified'}
    </Button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminProfiles({ onOpenCRM }: { onOpenCRM?: (userId: number) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [crmUserId, setCrmUserId] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState('');
  // Quick-delete from list
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [showDeletePin, setShowDeletePin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFetchError('');
    fetch('/api/admin/profiles', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfiles(d.data);
        } else {
          setFetchError(d.error || 'Failed to load profiles');
        }
      })
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // If CRM navigation requested, redirect to CRM page
  useEffect(() => {
    if (crmUserId !== null) {
      if (onOpenCRM) {
        onOpenCRM(crmUserId);
      } else {
        window.location.href = `/admin/crm?user=${crmUserId}`;
      }
      setCrmUserId(null);
    }
  }, [crmUserId, onOpenCRM]);

  const filtered = profiles.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.username.toLowerCase().includes(q) &&
        !(p.display_name || '').toLowerCase().includes(q) &&
        !(p.user_email || '').toLowerCase().includes(q) &&
        !(p.business_name || '').toLowerCase().includes(q)
      ) return false;
    }
    if (typeFilter !== 'all' && p.profile_type !== typeFilter) return false;
    if (statusFilter === 'published' && !p.is_published) return false;
    if (statusFilter === 'draft' && p.is_published) return false;
    if (verifiedFilter === 'verified' && !p.is_verified) return false;
    if (verifiedFilter === 'unverified' && p.is_verified) return false;
    if (verifiedFilter === 'pending' && !p.verification_requested_at) return false;
    return true;
  });

  if (editingProfile) {
    return (
      <ProfileEditPanel
        profile={editingProfile}
        onClose={() => setEditingProfile(null)}
        onSaved={updated => {
          setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
          setEditingProfile(null);
        }}
        onDeleted={id => {
          setProfiles(prev => prev.filter(p => p.id !== id));
          setEditingProfile(null);
        }}
        onOpenCRM={id => setCrmUserId(id)}
      />
    );
  }

  const executeQuickDelete = async (token: string) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/profiles/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'delete_profile' },
      });
      const d = await res.json();
      if (d.success) {
        setProfiles(prev => prev.filter(p => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch { /* ignore */ }
    setDeleting(false);
  };

  // Collect every duplicate profile that should be auto-deleted (all extras, keep oldest per type per user)
  const getDuplicatesToDelete = () => {
    const toDelete: Profile[] = [];
    Object.values(profilesByUser).forEach(g => {
      if (g.personal.length > 1) toDelete.push(...g.personal.slice(1));
      if (g.business.length > 1) toDelete.push(...g.business.slice(1));
    });
    return toDelete;
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [showBulkDeletePin, setShowBulkDeletePin] = useState(false);

  const executeBulkDelete = async (token: string) => {
    const targets = getDuplicatesToDelete();
    if (!targets.length) return;
    setBulkDeleting(true);
    setBulkProgress({ done: 0, total: targets.length });
    let deleted = 0;
    for (const p of targets) {
      try {
        const res = await fetch(`/api/admin/profiles/${p.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'delete_profile' },
        });
        const d = await res.json();
        if (d.success) {
          deleted++;
          setProfiles(prev => prev.filter(x => x.id !== p.id));
        }
      } catch { /* continue */ }
      setBulkProgress({ done: deleted, total: targets.length });
    }
    setBulkDeleting(false);
    setBulkProgress(null);
  };

  const verifiedCount = profiles.filter(p => p.is_verified).length;
  const pendingCount = profiles.filter(p => !p.is_verified && p.verification_requested_at).length;
  const publishedCount = profiles.filter(p => p.is_published).length;

  // Detect duplicate profiles — more than 1 personal OR more than 1 business per user
  const profilesByUser = profiles.reduce<Record<number, { personal: Profile[]; business: Profile[] }>>((acc, p) => {
    if (!acc[p.user_id]) acc[p.user_id] = { personal: [], business: [] };
    if (p.profile_type === 'personal') acc[p.user_id].personal.push(p);
    else if (p.profile_type === 'business') acc[p.user_id].business.push(p);
    return acc;
  }, {});
  const duplicateGroups = Object.entries(profilesByUser)
    .filter(([, g]) => g.personal.length > 1 || g.business.length > 1)
    .map(([userId, g]) => ({ userId: Number(userId), personal: g.personal, business: g.business }));

  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Manage Profiles — Admin</title>
        <meta name="description" content="Admin: manage all customer profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/profiles" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Profiles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {profiles.length} total · <span className="text-green-400">{publishedCount} published</span>
            {' · '}<span className="text-blue-400">{verifiedCount} verified</span>
            {pendingCount > 0 && <> · <span className="text-orange-400">{pendingCount} pending verification</span></>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{fetchError}</span>
          <button onClick={load} className="underline text-xs shrink-0">Retry</button>
        </div>
      )}

      {/* Duplicate profiles audit banner */}
      {duplicateGroups.length > 0 && (
        <div className="mb-5 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-start gap-2.5">
              <Copy className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-400">Duplicate profiles detected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {duplicateGroups.length} account{duplicateGroups.length > 1 ? 's have' : ' has'} more than one profile of the same type.
                  {' '}{getDuplicatesToDelete().length} duplicate{getDuplicatesToDelete().length !== 1 ? 's' : ''} will be removed — the oldest profile per type is kept.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5 shrink-0"
              onClick={() => setShowBulkDeletePin(true)}
              disabled={bulkDeleting}
            >
              {bulkDeleting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting {bulkProgress?.done}/{bulkProgress?.total}…</>
                : <><Trash2 className="w-3.5 h-3.5" /> Auto-delete all duplicates</>}
            </Button>
          </div>
          <div className="space-y-3">
            {duplicateGroups.map(group => {
              const allProfiles = [
                ...group.personal.map((p, i) => ({ ...p, isKeep: i === 0 })),
                ...group.business.map((p, i) => ({ ...p, isKeep: i === 0 })),
              ];
              return (
                <div key={group.userId} className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    User #{group.userId} · {(group.personal[0] || group.business[0])?.user_email}
                  </p>
                  {allProfiles.map(p => (
                    <div key={p.id} className="flex items-center gap-3 text-xs">
                      <Badge className={`text-xs border-0 shrink-0 ${p.profile_type === 'business' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                        {p.profile_type}
                      </Badge>
                      <span className="text-foreground font-mono flex-1 truncate">{p.username || p.biz_slug}</span>
                      <span className="text-xs text-muted-foreground shrink-0">#{p.id}</span>
                      {p.isKeep
                        ? <Badge className="text-xs border-0 bg-green-500/10 text-green-400 shrink-0">Keep</Badge>
                        : <Badge className="text-xs border-0 bg-red-500/10 text-red-400 shrink-0">Will delete</Badge>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search profiles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background border-border" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All verification" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verification</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="pending">Pending verification</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Showing {filtered.length} of {profiles.length} profiles
        {(search || typeFilter !== 'all' || statusFilter !== 'all' || verifiedFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setVerifiedFilter('all'); }}
            className="ml-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </p>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          {profiles.length === 0 ? (
            <p className="text-muted-foreground">No profiles have been created yet.</p>
          ) : (
            <>
              <p className="text-muted-foreground mb-3">No profiles match your filters.</p>
              <button
                onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setVerifiedFilter('all'); }}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <X className="w-3.5 h-3.5" /> Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const path = getProfilePath(p);
            return (
              <Card key={p.id} className="bg-card border-border hover:border-primary/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {p.profile_type === 'business'
                        ? <Building2 className="w-5 h-5 text-primary" />
                        : <span className="text-primary font-bold text-sm">{(p.display_name || p.username).charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-sm text-foreground">{p.display_name || p.username}</p>
                        {!!p.is_verified && <BadgeCheck className="w-4 h-4 text-blue-400" />}
                        {p.verification_requested_at && !p.is_verified && (
                          <Badge className="text-xs border-0 bg-orange-500/10 text-orange-400 gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                        <Badge className={`text-xs border-0 ${p.profile_type === 'business' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {p.profile_type === 'business' ? 'Business' : 'Personal'}
                        </Badge>
                        <Badge className={`text-xs border-0 ${p.is_published ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {p.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{path}</p>
                      <p className="text-xs text-muted-foreground">{p.user_name} · {p.user_email}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{p.view_count}</span>
                      <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{p.link_count}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.enquiry_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border gap-1 h-7 text-xs"
                        onClick={() => setEditingProfile(p)}
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </Button>
                      <a href={path} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Open owner in CRM"
                        onClick={() => setCrmUserId(p.user_id)}
                      >
                        <UserSearch className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                        title="Delete profile"
                        onClick={() => { setDeleteTarget(p); setShowDeletePin(true); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick-delete PIN challenge (from list or edit panel) */}
      <PinChallenge
        open={showDeletePin}
        action="delete_profile"
        actionLabel={deleteTarget ? `permanently delete the profile "${deleteTarget.display_name || deleteTarget.username}"` : 'permanently delete this profile'}
        onSuccess={token => { setShowDeletePin(false); executeQuickDelete(token); }}
        onCancel={() => { setShowDeletePin(false); setDeleteTarget(null); }}
      />

      {/* Bulk duplicate auto-delete PIN challenge */}
      <PinChallenge
        open={showBulkDeletePin}
        action="delete_profile"
        actionLabel={`permanently delete ${getDuplicatesToDelete().length} duplicate profile${getDuplicatesToDelete().length !== 1 ? 's' : ''} (oldest per type kept)`}
        onSuccess={token => { setShowBulkDeletePin(false); executeBulkDelete(token); }}
        onCancel={() => setShowBulkDeletePin(false)}
      />
    </div>
  );
}
