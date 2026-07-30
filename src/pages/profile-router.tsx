/**
 * ProfileRouter — dispatches /profile/* and legacy /:seg1/:seg2 to the correct page.
 *
 * New URL scheme:
 *   /profile/:username              → personal profile card
 *   /profile/:bizSlug               → business landing page
 *   /profile/:bizSlug/team          → team directory (public/private)
 *   /profile/:bizSlug/:personSlug   → business person's card
 *
 * Legacy (backwards compat for old QR codes / NFC cards):
 *   /F/:username  /S/:username  /P/:username  /B/:username  → personal profile
 *   /:bizSlug/:personSlug                                   → business person card
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Loader2 } from 'lucide-react';
import PublicProfilePage from './profile';
import BusinessProfilePage from './business-profile';
import TeamDirectoryPage from './team-directory';

const LEGACY_PREFIXES = new Set(['F', 'S', 'P', 'B']);

export default function ProfileRouter() {
  const { seg1, seg2 } = useParams<{ seg1: string; seg2: string }>();

  if (!seg1) return null;

  // ── Two-segment paths (/profile/:seg1/:seg2 or legacy /:seg1/:seg2) ──────
  if (seg2) {
    // Legacy plan prefix: /F/username → personal
    if (LEGACY_PREFIXES.has(seg1.toUpperCase()) && seg1.length === 1) {
      return <PublicProfilePage _overrideUsername={seg2} />;
    }

    // /profile/:bizSlug/team → team directory
    if (seg2.toLowerCase() === 'team') {
      return <TeamDirectoryPage bizSlug={seg1} />;
    }

    // /profile/:bizSlug/:personSlug → business person card
    return <BusinessProfilePage _overrideBizSlug={seg1} _overridePersonSlug={seg2} />;
  }

  // ── Single-segment /profile/:seg1 ────────────────────────────────────────
  // Could be a personal username OR a business slug.
  // Probe both APIs; render whichever responds 200 first.
  return <ProfileAutoRouter slug={seg1} />;
}

/**
 * Probes personal then business API to decide which page to render.
 * Avoids a hard-coded assumption about which type a slug belongs to.
 */
function ProfileAutoRouter({ slug }: { slug: string }) {
  const [type, setType] = useState<'personal' | 'business' | 'not_found' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profiles/${encodeURIComponent(slug)}/public`)
      .then(async r => {
        if (cancelled) return;
        // 200 = personal profile found
        if (r.ok) { setType('personal'); return; }
        // 403 with pin_required = personal profile exists but PIN-locked
        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          if (body.pin_required) { setType('personal'); return; }
        }
        // Not a personal profile — try business landing page
        fetch(`/api/business/${encodeURIComponent(slug)}/public`)
          .then(r2 => { if (!cancelled) setType(r2.ok ? 'business' : 'not_found'); })
          .catch(() => { if (!cancelled) setType('not_found'); });
      })
      .catch(() => { if (!cancelled) setType('not_found'); });
    return () => { cancelled = true; };
  }, [slug]);

  if (type === null) {
    return (
      <>
        <Helmet>
          <title>Loading profile…</title>
          <meta name="description" content="Loading profile page." />
          <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/profile" />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (type === 'personal') return <PublicProfilePage _overrideUsername={slug} />;
  if (type === 'business') return <BusinessProfilePage _overrideBizSlug={slug} _overridePersonSlug="" />;

  return (
    <>
      <Helmet>
        <title>Profile not found</title>
        <meta name="description" content="The requested profile could not be found." />
        <link rel="canonical" href={`https://japrofilestudio.jagroupservices.co.uk/profile/${slug}`} />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2 px-4">
          <h1 className="text-2xl font-bold text-foreground">Profile not found</h1>
          <p className="text-muted-foreground text-sm">
            The profile at <code className="font-mono bg-muted px-1 rounded">/profile/{slug}</code> doesn&apos;t exist.
          </p>
        </div>
      </div>
    </>
  );
}
