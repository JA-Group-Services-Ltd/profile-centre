/**
 * Admin Profile Preview
 * Renders a read-only view of any profile (published or not) for admin use.
 * Fetches via /api/admin/profiles/:id/preview — requires admin session.
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ArrowLeft, ExternalLink, Eye, EyeOff, Building2, User,
  Globe, Mail, Phone, MapPin, Briefcase, Link2, AlertTriangle,
  Loader2, Badge as BadgeIcon, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfileLink {
  id: number;
  title: string;
  url: string;
  platform: string;
  sort_order: number;
}

interface ProfileData {
  id: number;
  username: string;
  display_name: string | null;
  business_name: string | null;
  biz_slug: string | null;
  person_slug: string | null;
  profile_type: string;
  bio: string | null;
  job_title: string | null;
  company: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  profile_photo: string | null;
  cover_url: string | null;
  logo_url: string | null;
  is_published: number;
  is_suspended: number;
  is_hidden: number;
  is_verified: number;
  created_at: string;
  updated_at: string | null;
  user_email: string | null;
  user_name: string | null;
  plan_name: string | null;
  theme_id: string | null;
  primary_colour: string | null;
}

export default function AdminProfilePreview() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/profiles/${id}/preview`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfile(d.data.profile);
          setLinks(d.data.links || []);
        } else {
          setError(d.error || 'Profile not found');
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !profile) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive opacity-60" />
      <p className="text-destructive mb-4">{error || 'Profile not found'}</p>
      <Link to="/admin/profiles">
        <Button variant="outline" className="border-border gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Profiles
        </Button>
      </Link>
    </div>
  );

  const isBusiness = profile.profile_type === 'business';
  const displayName = isBusiness
    ? (profile.business_name || profile.display_name || profile.username)
    : (profile.display_name || profile.username);
  const liveUrl = isBusiness && profile.biz_slug
    ? `/profile/${profile.biz_slug}`
    : `/profile/${profile.username}`;
  const initials = displayName.slice(0, 2).toUpperCase();
  const accentColor = profile.primary_colour || '#2563eb';

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-4">
      <Helmet>
        <title>Preview: {displayName} — Admin</title>
        <meta name="description" content={`Admin preview of profile: ${displayName}`} />
        <link rel="canonical" href={`https://japrofilestudio.jagroupservices.co.uk/admin/profile-preview/${profile.id}`} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="sr-only">Admin Preview: {displayName}</h1>
        <Link to={`/admin/profiles`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Profiles
          </Button>
        </Link>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {profile.is_published ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> View Live
              </Button>
            </a>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-400 border-0 text-xs px-3 py-1.5">
              <EyeOff className="w-3 h-3 mr-1.5" /> Unpublished — live page not accessible to public
            </Badge>
          )}
        </div>
      </div>

      {/* Admin notice banner */}
      <div className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300 leading-relaxed">
          <strong className="text-amber-200">Admin preview</strong> — this view shows the profile data regardless of published status. The public cannot see unpublished profiles.
        </p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge className={`text-xs border-0 ${profile.is_published ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
          {profile.is_published ? <><Eye className="w-3 h-3 mr-1" />Published</> : <><EyeOff className="w-3 h-3 mr-1" />Unpublished</>}
        </Badge>
        {!!profile.is_suspended && <Badge className="text-xs border-0 bg-red-500/10 text-red-400">Suspended</Badge>}
        {!!profile.is_hidden && <Badge className="text-xs border-0 bg-orange-500/10 text-orange-400">Hidden</Badge>}
        {!!profile.is_verified && <Badge className="text-xs border-0 bg-blue-500/10 text-blue-400"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
        <Badge className={`text-xs border-0 ${isBusiness ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
          {isBusiness ? <><Building2 className="w-3 h-3 mr-1" />Business</> : <><User className="w-3 h-3 mr-1" />Personal</>}
        </Badge>
      </div>

      {/* Profile card — visual preview */}
      <Card className="bg-card border-border mb-6 overflow-hidden">
        {/* Cover */}
        <div
          className="h-28 w-full relative"
          style={{
            background: profile.cover_url
              ? `url(${profile.cover_url}) center/cover no-repeat`
              : `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`,
          }}
        >
          {!profile.is_published && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-xs text-white/70 font-medium tracking-wide uppercase">Unpublished</span>
            </div>
          )}
        </div>

        <CardContent className="p-5 -mt-10 relative">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl border-4 border-card overflow-hidden flex items-center justify-center text-white font-bold text-xl mb-3 shadow-lg"
            style={{ background: profile.profile_photo ? undefined : accentColor }}
          >
            {profile.profile_photo ? (
              <img src={profile.profile_photo} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <h2 className="text-xl font-bold text-foreground mb-0.5">{displayName}</h2>
          {profile.job_title && <p className="text-sm text-muted-foreground mb-0.5">{profile.job_title}</p>}
          {profile.company && !isBusiness && <p className="text-xs text-muted-foreground mb-2">{profile.company}</p>}
          {profile.bio && <p className="text-sm text-foreground/80 leading-relaxed mt-2 max-w-lg">{profile.bio}</p>}
        </CardContent>
      </Card>

      {/* Contact details */}
      <Card className="bg-card border-border mb-4">
        <CardHeader><CardTitle className="text-sm">Contact Details</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {profile.contact_email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground break-all">{profile.contact_email}</span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{profile.phone}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-2.5 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.website}</a>
            </div>
          )}
          {profile.address && (
            <div className="flex items-start gap-2.5 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-foreground whitespace-pre-line">{profile.address}</span>
            </div>
          )}
          {!profile.contact_email && !profile.phone && !profile.website && !profile.address && (
            <p className="text-xs text-muted-foreground">No contact details set</p>
          )}
        </CardContent>
      </Card>

      {/* Links */}
      {links.length > 0 && (
        <Card className="bg-card border-border mb-4">
          <CardHeader><CardTitle className="text-sm">Profile Links ({links.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{link.title || link.platform}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Account info */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm">Account Info</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Owner</span><span className="text-foreground font-medium">{profile.user_name || '—'}</span></div>
          <div className="flex justify-between"><span>Email</span><span className="text-foreground font-medium break-all">{profile.user_email || '—'}</span></div>
          <div className="flex justify-between"><span>Plan</span><span className="text-foreground font-medium">{profile.plan_name || 'Free'}</span></div>
          <div className="flex justify-between"><span>Username / Slug</span><span className="text-foreground font-mono">{profile.username}</span></div>
          {isBusiness && profile.biz_slug && (
            <div className="flex justify-between"><span>Business Slug</span><span className="text-foreground font-mono">{profile.biz_slug}</span></div>
          )}
          <div className="flex justify-between"><span>Created</span><span className="text-foreground">{fmtDate(profile.created_at)}</span></div>
          {profile.updated_at && (
            <div className="flex justify-between"><span>Last updated</span><span className="text-foreground">{fmtDate(profile.updated_at)}</span></div>
          )}
          <div className="flex justify-between"><span>Profile ID</span><span className="text-foreground font-mono">#{profile.id}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
