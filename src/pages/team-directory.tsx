/**
 * Public team directory page
 * /profile/:bizSlug/team
 *
 * Shows all team members for a business. Respects the team_directory_public lock.
 */
import { useState, useEffect } from 'react';
import { Loader2, Lock, Users, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';

interface TeamMember {
  person_slug: string;
  display_name: string;
  job_title: string | null;
  profile_photo: string | null;
  bio: string | null;
  url: string;
}

interface TeamData {
  business_name: string;
  biz_slug: string;
  logo_url: string | null;
  cover_url: string | null;
  members: TeamMember[];
  seats: { name: string; role: string; profile_photo: string | null }[];
}

export default function TeamDirectoryPage({ bizSlug }: { bizSlug: string }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/business/${encodeURIComponent(bizSlug)}/team`)
      .then(async r => {
        if (r.status === 403) { setLocked(true); return; }
        const json = await r.json();
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [bizSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet><title>Team Directory — Private</title></Helmet>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">Team directory is private</p>
          <p className="text-sm text-muted-foreground">This business has made their team directory private.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Business not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{data.business_name} — Team Directory</title>
        <meta name="description" content={`Meet the team at ${data.business_name}`} />
      </Helmet>

      {/* Cover */}
      {data.cover_url && (
        <div className="h-40 w-full bg-muted overflow-hidden">
          <img src={data.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          {data.logo_url ? (
            <img src={data.logo_url} alt={data.business_name} className="w-14 h-14 rounded-xl object-contain bg-muted" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{data.business_name}</h1>
            <p className="text-sm text-muted-foreground">Team Directory</p>
          </div>
        </div>

        {/* Back to business page */}
        <Link
          to={`/profile/${bizSlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-6"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View business page
        </Link>

        {/* Members */}
        {data.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No team members listed yet.</p>
        ) : (
          <div className="grid gap-3">
            {data.members.map(member => (
              <Link
                key={member.person_slug}
                to={member.url}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
              >
                {member.profile_photo ? (
                  <img src={member.profile_photo} alt={member.display_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-lg">{(member.display_name || '?')[0].toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{member.display_name}</p>
                  {member.job_title && <p className="text-sm text-muted-foreground truncate">{member.job_title}</p>}
                  {member.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{member.bio}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
