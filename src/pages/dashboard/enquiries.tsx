/**
 * Dashboard — Contact Enquiries
 * Shows contact form submissions from public profile visitors.
 * Includes an enable/disable toggle for the enquiry form.
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Mail, MailOpen, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Enquiry {
  id: number; sender_name: string; sender_email: string; message: string;
  created_at: string; is_read: number; profile_name: string; username: string;
  profile_id?: number;
}

interface ProfileInfo {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
}

function profileLabel(p: ProfileInfo): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function EnquiriesPage() {
  const [allEnquiries, setAllEnquiries] = useState<Enquiry[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [enquiryEnabled, setEnquiryEnabled] = useState<boolean>(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    // Load profiles + enquiry toggle status
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        if (d.success && d.data.length > 0) {
          const profs: ProfileInfo[] = d.data;
          setProfiles(profs);
          // Default to personal profile
          const defaultProfile = profs.find(p => p.profile_type !== 'business') ?? profs[0];
          setSelectedProfileId(defaultProfile.id);
          const ps = await fetch(`/api/profiles/${defaultProfile.id}/pin/status`, { credentials: 'include' }).then(r => r.json());
          if (ps.success) setEnquiryEnabled(!!ps.data.enquiry_enabled);
        }
      });

    fetch('/api/enquiries', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAllEnquiries(d.data); })
      .finally(() => setLoading(false));
  }, []);

  // Filter enquiries when profile selection or data changes
  useEffect(() => {
    if (profiles.length <= 1 || selectedProfileId === null) {
      setEnquiries(allEnquiries);
    } else {
      setEnquiries(allEnquiries.filter(e => e.profile_id === selectedProfileId || e.username === profiles.find(p => p.id === selectedProfileId)?.username));
    }
  }, [allEnquiries, selectedProfileId, profiles]);

  const switchProfile = async (id: number) => {
    setSelectedProfileId(id);
    setExpanded(null);
    // Load enquiry toggle for the newly selected profile
    const ps = await fetch(`/api/profiles/${id}/pin/status`, { credentials: 'include' }).then(r => r.json());
    if (ps.success) setEnquiryEnabled(!!ps.data.enquiry_enabled);
  };

  // profileId for toggle operations — use selected profile
  const profileId = selectedProfileId;

  const markRead = async (id: number) => {
    await fetch(`/api/enquiries/${id}/read`, { method: 'PUT', credentials: 'include' });
    setAllEnquiries(e => e.map(x => x.id === id ? { ...x, is_read: 1 } : x));
  };

  const toggleExpand = (id: number) => {
    setExpanded(e => e === id ? null : id);
    const enquiry = enquiries.find(e => e.id === id);
    if (enquiry && !enquiry.is_read) markRead(id);
  };

  const handleToggleEnquiry = async (enabled: boolean) => {
    if (!profileId || toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/enquiry`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) setEnquiryEnabled(!!data.enquiry_enabled);
    } finally {
      setToggling(false);
    }
  };

  const unreadCount = enquiries.filter(e => !e.is_read).length;

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Enquiries — Dashboard</title>
        <meta name="description" content="View and manage contact enquiries from your profile visitors." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/enquiries" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contact Enquiries</h1>
          <p className="text-muted-foreground mt-1">Messages from your profile visitors</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge className="bg-primary text-white border-0">{unreadCount} unread</Badge>
          )}
          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-border gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-card border-border p-1">
              <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Contact Form</p>
                  <p className="text-xs text-muted-foreground">Show enquiry form on your public card</p>
                </div>
                <Switch
                  checked={enquiryEnabled}
                  onCheckedChange={handleToggleEnquiry}
                  disabled={toggling}
                  className="flex-shrink-0"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Profile selector — themes style, only when multiple profiles */}
      {profiles.length > 1 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Viewing enquiries for:</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => switchProfile(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedProfileId === p.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {profileLabel(p)}
                <span className="ml-1.5 opacity-60">{p.profile_type === 'business' ? 'Business' : 'Personal'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Disabled banner */}
      {!enquiryEnabled && (
        <div className="mb-6 flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <ToggleLeft className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-400">Contact form is turned off</p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              The enquiry form is hidden on your public card. Existing enquiries are still accessible here.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 flex-shrink-0 gap-1.5"
            onClick={() => handleToggleEnquiry(true)}
            disabled={toggling}
          >
            <ToggleRight className="w-4 h-4" /> Enable
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : enquiries.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-2">No enquiries yet</h3>
          <p className="text-muted-foreground text-sm">When visitors send you messages, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map(e => (
            <Card key={e.id} className={`border transition-all cursor-pointer ${!e.is_read ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3" onClick={() => toggleExpand(e.id)}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${!e.is_read ? 'bg-primary/20' : 'bg-muted'}`}>
                    {e.is_read ? <MailOpen className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${!e.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{e.sender_name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</span>
                        {!e.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                        {expanded === e.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.sender_email}</p>
                    {expanded !== e.id && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{e.message}</p>
                    )}
                  </div>
                </div>

                {expanded === e.id && (
                  <div className="mt-4 pl-12">
                    <div className="p-3 rounded-xl bg-muted/50 border border-border">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{e.message}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <a href={`mailto:${e.sender_email}`}>
                        <Button size="sm" className="bg-primary gap-2">
                          <Mail className="w-3.5 h-3.5" /> Reply via Email
                        </Button>
                      </a>
                      {!e.is_read && (
                        <Button size="sm" variant="outline" onClick={() => markRead(e.id)} className="border-border gap-2">
                          <MailOpen className="w-3.5 h-3.5" /> Mark as Read
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Profile: /{e.username}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
