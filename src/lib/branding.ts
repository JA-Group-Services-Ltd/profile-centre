import { useState, useEffect } from 'react';

export interface Branding {
  platform_name: string;
  platform_tagline: string;
  platform_description: string;
  platform_url: string;
  platform_logo_url: string;
  platform_favicon_url: string;
  master_brand_name: string;
  master_brand_url: string;
  legal_company_name: string;
  legal_company_number: string;
  footer_tagline: string;
  footer_show_legal_name: string;
  footer_links: string; // JSON: FooterColumn[]
  support_email: string;
  contact_email: string;
  social_twitter: string;
  social_linkedin: string;
  social_instagram: string;
  social_facebook: string;
}

const DEFAULTS: Branding = {
  platform_name: 'Sousa Murray Profiles',
  platform_tagline: 'Your digital business card, reimagined.',
  platform_description: 'Create a stunning digital profile that showcases who you are and what you do — share it with a single link.',
  platform_url: 'https://sousamurrayprofiles.jagroupservices.co.uk',
  platform_logo_url: '',
  platform_favicon_url: '',
  master_brand_name: 'Sousa Murray',
  master_brand_url: 'https://jagroupservices.co.uk',
  legal_company_name: 'JA Group Services Ltd',
  legal_company_number: '16314179',
  footer_tagline: 'A Sousa Murray brand operated by JA Group Services Ltd',
  footer_show_legal_name: '1',
  footer_links: '',
  support_email: 'contact@jagroupservices.co.uk',
  contact_email: 'contact@jagroupservices.co.uk',
  social_twitter: '',
  social_linkedin: '',
  social_instagram: '',
  social_facebook: '',
};

// Module-level cache so all components share one fetch
let cached: Branding | null = null;
let fetchPromise: Promise<void> | null = null;

function fetchBranding(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch('/api/branding')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        cached = { ...DEFAULTS, ...data.data };
        // Board policy: customer-facing brands use a text-only word mark.
        if (cached) cached.platform_logo_url = '';
      }
    })
    .catch(() => {
      // silently fall back to defaults
    });
  return fetchPromise;
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cached ?? DEFAULTS);

  useEffect(() => {
    if (cached) {
      setBranding(cached);
      return;
    }
    fetchBranding().then(() => {
      if (cached) setBranding(cached);
    });
  }, []);

  return branding;
}
