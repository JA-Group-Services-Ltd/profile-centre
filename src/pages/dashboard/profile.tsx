import { useState, useEffect, useRef } from 'react';
import { fmtDate } from '@/lib/date';
import { ExternalLink, Camera, Save, Check, Mail, Search, Lock, KeyRound, RefreshCw, Eye, EyeOff, Zap, ArrowRight, BadgeCheck, Clock, AlertCircle, Palette, Plus, X as XIcon, Info, Building2, User, ChevronRight, ArrowLeft, QrCode } from 'lucide-react';
import ProfileFeatureTabs from '@/components/dashboard/ProfileFeatureTabs';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import BusinessProfileDashboard from './business-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import ProfileExport from '@/components/ProfileExport';

// ─── Tag / chip editor (skills, languages, awards, certifications) ────────────

function SkillsEditor({ label, placeholder, hint, value, onChange }: {
  label: string; placeholder: string; hint: string;
  value: string[]; onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) { setInput(''); return; }
    onChange([...value, trimmed]);
    setInput('');
  };
  const removeItem = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div>
      <Label>{label} <span className="text-muted-foreground font-normal">(optional)</span></Label>
      <div className="mt-1.5 flex flex-wrap gap-1.5 mb-2">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {item}
            <button type="button" onClick={() => removeItem(i)} className="hover:text-destructive transition-colors ml-0.5">
              <XIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addItem(); } }}
          className="bg-background border-border text-sm"
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-border flex-shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

// ─── Experience / Education entry editor ──────────────────────────────────────

interface ExpEntry { title: string; org: string; period: string; description: string; }

function ExperienceEditor({ label, isEducation = false, value, onChange }: {
  label: string; isEducation?: boolean;
  value: ExpEntry[]; onChange: (v: ExpEntry[]) => void;
}) {
  const addEntry = () => onChange([...value, { title: '', org: '', period: '', description: '' }]);
  const updateEntry = (i: number, field: keyof ExpEntry, v: string) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const removeEntry = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{label} <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Button type="button" variant="outline" size="sm" onClick={addEntry} className="border-border gap-1 text-xs h-7">
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No entries yet. Click Add to get started.</p>
      )}
      <div className="space-y-3">
        {value.map((entry, i) => (
          <div key={i} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2 relative">
            <button type="button" onClick={() => removeEntry(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
            <div className="grid sm:grid-cols-2 gap-2 pr-6">
              <Input value={entry.title} onChange={e => updateEntry(i, 'title', e.target.value)}
                className="bg-background border-border text-sm" placeholder={isEducation ? 'Degree / Qualification' : 'Job Title / Role'} />
              <Input value={entry.org} onChange={e => updateEntry(i, 'org', e.target.value)}
                className="bg-background border-border text-sm" placeholder={isEducation ? 'Institution / University' : 'Company / Organisation'} />
            </div>
            <Input value={entry.period} onChange={e => updateEntry(i, 'period', e.target.value)}
              className="bg-background border-border text-sm" placeholder="e.g. Jan 2022 – Present" />
            <Textarea value={entry.description} onChange={e => updateEntry(i, 'description', e.target.value)}
              className="bg-background border-border text-sm resize-none" rows={2}
              placeholder={isEducation ? 'Subject, grade, or notes (optional)' : 'Brief description of your role (optional)'} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Personal profile type config ────────────────────────────────────────────

const PERSONAL_TYPES = [
  { value: 'professional',    label: 'Professional',        icon: '💼', hint: 'Corporate, office-based, or career-focused professional' },
  { value: 'content_creator', label: 'Content Creator',     icon: '🎬', hint: 'YouTuber, blogger, podcaster, influencer, streamer' },
  { value: 'freelancer',      label: 'Freelancer',          icon: '🎯', hint: 'Independent contractor or self-employed' },
  { value: 'consultant',      label: 'Consultant',          icon: '📊', hint: 'Expert advisor or independent consultant' },
  { value: 'artist',          label: 'Artist / Creative',   icon: '🎨', hint: 'Visual artist, musician, writer, designer' },
  { value: 'speaker',         label: 'Speaker',             icon: '🎤', hint: 'Public speaker, presenter, MC, trainer' },
  { value: 'coach',           label: 'Coach / Mentor',      icon: '🏆', hint: 'Life coach, business coach, sports coach, mentor' },
  { value: 'portfolio',       label: 'Portfolio',           icon: '🗂️', hint: 'Showcase your work and projects' },
  { value: 'personal_brand',  label: 'Personal Brand',      icon: '⭐', hint: 'Building your personal brand and online presence' },
  { value: 'volunteer',       label: 'Volunteer / Charity', icon: '🤝', hint: 'Charity worker, volunteer, community organiser' },
  { value: 'faith',           label: 'Faith / Ministry',    icon: '✝️', hint: 'Church leader, pastor, ministry worker, faith community' },
  { value: 'nonprofit',       label: 'Non-profit / NGO',    icon: '🌍', hint: 'NGO worker, social enterprise, community organisation' },
  { value: 'student',         label: 'Student',             icon: '🎓', hint: 'University student, apprentice, recent graduate' },
  { value: 'other',           label: 'Other',               icon: '✨', hint: 'Flexible layout for any personal profile' },
] as const;

type PersonalTypeValue = typeof PERSONAL_TYPES[number]['value'];

// ─── Per-type configuration: hints + which sections to show ──────────────────

interface TypeConfig {
  headline: string;
  jobTitleLabel: string;
  jobTitleHint: string;
  companyLabel: string;
  companyHint: string;
  bioHint: string;
  // Which extended sections to show (all others hidden)
  sections: {
    headline: boolean;
    pronouns: boolean;
    location: boolean;
    availability: boolean;
    portfolioUrl: boolean;
    skills: boolean;
    languages: boolean;
    awards: boolean;
    certifications: boolean;
    experience: boolean;
    education: boolean;
    // Creator-specific
    socialChannels: boolean;
    contentNiche: boolean;
    collabRate: boolean;
    contentFormats: boolean;
    platforms: boolean;
    // Speaker
    speakingTopics: boolean;
    // Coach
    coachingAreas: boolean;
    // Volunteer / nonprofit
    volunteerCauses: boolean;
    // Faith
    ministryRole: boolean;
    // Consultant / speaker
    publications: boolean;
    // Student extras
    gpa: boolean;
    graduationYear: boolean;
    internships: boolean;
    clubs: boolean;
  };
}

const TYPE_CONFIG: Record<PersonalTypeValue, TypeConfig> = {
  professional: {
    headline: 'Professional profile',
    jobTitleLabel: 'Job Title',
    jobTitleHint: 'e.g. Senior Product Manager',
    companyLabel: 'Company / Organisation',
    companyHint: 'e.g. Acme Corp',
    bioHint: 'Briefly describe your expertise and what you do professionally.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: false, skills: true, languages: true, awards: true, certifications: true, experience: true, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  content_creator: {
    headline: 'Content creator profile',
    jobTitleLabel: 'Creator Title',
    jobTitleHint: 'e.g. Travel Blogger & Photographer',
    companyLabel: 'Channel / Brand Name',
    companyHint: 'e.g. The Wandering Lens',
    bioHint: 'Tell people what content you create, your niche, and where they can find you.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: false, awards: true, certifications: false, experience: false, education: false, socialChannels: true, contentNiche: true, collabRate: true, contentFormats: true, platforms: true, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  freelancer: {
    headline: 'Freelancer profile',
    jobTitleLabel: 'Freelance Role',
    jobTitleHint: 'e.g. Freelance Web Developer',
    companyLabel: 'Trading Name (optional)',
    companyHint: 'e.g. JD Design Studio',
    bioHint: 'Describe your services, skills, and how clients can work with you.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: true, awards: true, certifications: true, experience: true, education: false, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  consultant: {
    headline: 'Consultant profile',
    jobTitleLabel: 'Consulting Title',
    jobTitleHint: 'e.g. Business Strategy Consultant',
    companyLabel: 'Firm / Practice Name',
    companyHint: 'e.g. Smith Advisory',
    bioHint: 'Describe your area of expertise and the value you bring to clients.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: false, skills: true, languages: true, awards: true, certifications: true, experience: true, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: true, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  artist: {
    headline: 'Artist / Creative profile',
    jobTitleLabel: 'Creative Role',
    jobTitleHint: 'e.g. Illustrator & Graphic Designer',
    companyLabel: 'Studio / Label',
    companyHint: 'e.g. Blue Ink Studio',
    bioHint: 'Describe your creative practice, medium, and the work you produce.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: false, awards: true, certifications: false, experience: false, education: false, socialChannels: true, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  speaker: {
    headline: 'Speaker profile',
    jobTitleLabel: 'Speaker Title',
    jobTitleHint: 'e.g. Keynote Speaker & Author',
    companyLabel: 'Agency / Organisation',
    companyHint: 'e.g. Speakers Bureau Ltd',
    bioHint: 'Describe your speaking topics, style, and experience on stage.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: false, languages: true, awards: true, certifications: false, experience: true, education: false, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: true, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: true, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  coach: {
    headline: 'Coach / Mentor profile',
    jobTitleLabel: 'Coaching Title',
    jobTitleHint: 'e.g. Executive Life Coach',
    companyLabel: 'Practice / Organisation',
    companyHint: 'e.g. Elevate Coaching',
    bioHint: 'Describe who you help, how you help them, and your coaching approach.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: false, skills: false, languages: true, awards: true, certifications: true, experience: true, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: true, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  portfolio: {
    headline: 'Portfolio',
    jobTitleLabel: 'Role / Title',
    jobTitleHint: 'e.g. Full-Stack Developer',
    companyLabel: 'Company / Client',
    companyHint: 'e.g. Available for hire',
    bioHint: 'Introduce yourself and the type of work showcased in your portfolio.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: false, awards: true, certifications: true, experience: true, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  personal_brand: {
    headline: 'Personal brand',
    jobTitleLabel: 'Title / Role',
    jobTitleHint: 'e.g. Entrepreneur & Investor',
    companyLabel: 'Company / Venture',
    companyHint: 'e.g. Founder @ Acme',
    bioHint: 'Tell people who you are, what you stand for, and what you are building.',
    sections: { headline: true, pronouns: true, location: true, availability: false, portfolioUrl: true, skills: true, languages: true, awards: true, certifications: false, experience: true, education: false, socialChannels: true, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  volunteer: {
    headline: 'Volunteer / Charity profile',
    jobTitleLabel: 'Volunteer Role',
    jobTitleHint: 'e.g. Community Outreach Coordinator',
    companyLabel: 'Organisation / Charity',
    companyHint: 'e.g. Red Cross UK',
    bioHint: 'Describe the causes you support and the work you do in your community.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: false, skills: true, languages: true, awards: true, certifications: false, experience: false, education: false, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: true, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  faith: {
    headline: 'Faith / Ministry profile',
    jobTitleLabel: 'Ministry Role',
    jobTitleHint: 'e.g. Senior Pastor, Youth Leader',
    companyLabel: 'Church / Ministry',
    companyHint: 'e.g. Grace Community Church',
    bioHint: 'Share your ministry, calling, and the community you serve.',
    sections: { headline: true, pronouns: false, location: true, availability: false, portfolioUrl: false, skills: false, languages: true, awards: false, certifications: false, experience: false, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: true, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  nonprofit: {
    headline: 'Non-profit / NGO profile',
    jobTitleLabel: 'Role / Position',
    jobTitleHint: 'e.g. Programme Director',
    companyLabel: 'Organisation',
    companyHint: 'e.g. Shelter UK',
    bioHint: "Describe your organisation's mission and your role within it.",
    sections: { headline: true, pronouns: true, location: true, availability: false, portfolioUrl: true, skills: true, languages: true, awards: true, certifications: false, experience: true, education: false, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: true, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
  student: {
    headline: 'Student profile',
    jobTitleLabel: 'Course / Programme',
    jobTitleHint: 'e.g. BSc Computer Science',
    companyLabel: 'University / College',
    companyHint: 'e.g. University of Manchester',
    bioHint: "Tell people what you're studying, your interests, and what you're looking for.",
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: true, awards: true, certifications: true, experience: false, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: true, graduationYear: true, internships: true, clubs: true },
  },
  other: {
    headline: 'Personal profile',
    jobTitleLabel: 'Job Title / Role',
    jobTitleHint: 'e.g. Your job title',
    companyLabel: 'Company / Organisation',
    companyHint: 'e.g. Where you work',
    bioHint: 'Tell people about yourself.',
    sections: { headline: true, pronouns: true, location: true, availability: true, portfolioUrl: true, skills: true, languages: true, awards: true, certifications: true, experience: true, education: true, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  },
};

const PERSONAL_LAYOUT_PRESETS = [
  { value: 'card',      label: 'Card',      desc: 'Compact digital business card' },
  { value: 'profile',   label: 'Profile',   desc: 'Full profile with sections' },
  { value: 'minimal',   label: 'Minimal',   desc: 'Clean, link-focused layout' },
  { value: 'portfolio', label: 'Portfolio', desc: 'Work-showcase layout' },
] as const;

const PERSONAL_COLOUR_PALETTES = [
  { value: 'brand',   label: 'Brand Blue',   primary: '#2563eb' },
  { value: 'forest',  label: 'Forest Green', primary: '#16a34a' },
  { value: 'slate',   label: 'Slate',        primary: '#475569' },
  { value: 'rose',    label: 'Rose',         primary: '#e11d48' },
  { value: 'amber',   label: 'Amber',        primary: '#d97706' },
  { value: 'violet',  label: 'Violet',       primary: '#7c3aed' },
  { value: 'teal',    label: 'Teal',         primary: '#0d9488' },
  { value: 'custom',  label: 'Custom',       primary: '' },
] as const;

const PERSONAL_BUTTON_STYLES = [
  { value: 'rounded', label: 'Rounded', preview: 'rounded-full' },
  { value: 'sharp',   label: 'Sharp',   preview: 'rounded-none' },
  { value: 'soft',    label: 'Soft',    preview: 'rounded-lg' },
  { value: 'outline', label: 'Outline', preview: 'rounded-lg border-2' },
] as const;

const PHOTO_SHAPES = [
  { value: 'circle',  label: 'Circle',  preview: 'rounded-full' },
  { value: 'rounded', label: 'Rounded', preview: 'rounded-2xl' },
  { value: 'square',  label: 'Square',  preview: 'rounded-none' },
] as const;

// ─── Feature toggles sub-component ───────────────────────────────────────────

function ProfileFeatureToggles({ profileId }: { profileId: number }) {
  const [enquiryEnabled, setEnquiryEnabled] = useState<boolean | null>(null);
  const [togglingEnq, setTogglingEnq] = useState(false);

  useEffect(() => {
    fetch(`/api/profiles/${profileId}/pin/status`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEnquiryEnabled(!!d.data.enquiry_enabled);
        }
      });
  }, [profileId]);

  const toggleEnquiry = async (enabled: boolean) => {
    setTogglingEnq(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/enquiry`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) setEnquiryEnabled(!!data.enquiry_enabled);
    } finally { setTogglingEnq(false); }
  };

  if (enquiryEnabled === null) return null;

  return (
    <Card className="bg-card border-border mb-6">
      <CardHeader>
        <CardTitle className="text-base">Features on Your Card</CardTitle>
        <CardDescription>Control which interactive features appear on your public profile</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Contact Enquiry Form</p>
              <p className="text-xs text-muted-foreground">
                On — visitors see an enquiry form. Off — visitors see an email link instead.
              </p>
            </div>
          </div>
          <Switch
            checked={enquiryEnabled ?? false}
            onCheckedChange={toggleEnquiry}
            disabled={togglingEnq}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface Profile {
  id: number; username: string; display_name: string; job_title: string; company: string;
  bio: string; bio_html: string | null; phone: string; email: string; website: string; address: string;
  business_address: string;
  profile_photo: string; is_published: number;
  show_phone: number; show_email: number; show_website: number; show_address: number; show_bio: number;
  theme_id: number;
  profile_type: string;
  biz_slug: string | null; person_slug: string | null;
  allow_indexing: number;
  seo_title: string;
  seo_description: string;
  public_pin_enabled: number;
  is_verified: number;
  verified_at: string | null;
  verification_requested_at: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const branding = useBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // editingOrgId: when set, show the org editor inline instead of the main page
  const editingOrgId = searchParams.get('editOrg');
  const setEditingOrg = (id: string | null) => {
    if (id) setSearchParams({ editOrg: id });
    else setSearchParams({});
  };

  // Scroll to org section when ?section=org is in the URL
  useEffect(() => {
    if (searchParams.get('section') === 'org' && !editingOrgId) {
      setTimeout(() => {
        const el = document.getElementById('org-profiles');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [searchParams.get('section'), editingOrgId, loading]);

  const [form, setForm] = useState({
    username: '', display_name: '', job_title: '', company: '', bio: '', bio_html: '',
    phone: '', email: '', website: '', address: '', business_address: '', profile_photo: '',
    is_published: 1, show_phone: 1, show_email: 1, show_website: 1, show_address: 1, show_bio: 1,
    allow_indexing: 0, seo_title: '', seo_description: '',
  });
  const [useHtmlBio, setUseHtmlBio] = useState(false); // kept for data compat — HTML mode removed from UI

  // Profile type & design state
  const [personalType, setPersonalType] = useState<PersonalTypeValue>('professional');
  const [layoutPreset, setLayoutPreset] = useState<string>('card');
  const [colourPalette, setColourPalette] = useState<string>('brand');
  const [customColour, setCustomColour] = useState('#2563eb');
  const [buttonStyle, setButtonStyle] = useState<string>('rounded');
  const [photoShape, setPhotoShape] = useState<string>('circle');
  const [showTypeDesign, setShowTypeDesign] = useState(true);

  // Extended profile fields
  const [extendedFields, setExtendedFields] = useState<{
    headline: string; pronouns: string; location_city: string; availability: string; portfolio_url: string;
    skills: string[]; languages: string[]; awards: string[]; certifications: string[];
    experience: { title: string; org: string; period: string; description: string }[];
    education: { title: string; org: string; period: string; description: string }[];
    // Creator-specific
    social_channels: string[];
    content_niche: string;
    collab_rate: string;
    content_formats: string[];
    platforms: string[];
    // Speaker
    speaking_topics: string[];
    // Coach
    coaching_areas: string[];
    // Volunteer / nonprofit
    volunteer_causes: string[];
    // Faith
    ministry_role: string;
    // Consultant / speaker
    publications: string[];
    // Student extras
    gpa: string;
    graduation_year: string;
    internships: string[];
    clubs: string[];
  }>({
    headline: '', pronouns: '', location_city: '', availability: '', portfolio_url: '',
    skills: [], languages: [], awards: [], certifications: [], experience: [], education: [],
    social_channels: [], content_niche: '', collab_rate: '', content_formats: [], platforms: [],
    speaking_topics: [], coaching_areas: [], volunteer_causes: [], ministry_role: '',
    publications: [], gpa: '', graduation_year: '', internships: [], clubs: [],
  });

  // Public PIN state
  const [publicPinEnabled, setPublicPinEnabled] = useState(false);
  const [publicPinSaving, setPublicPinSaving] = useState(false);
  const [publicPinResult, setPublicPinResult] = useState<{ pin: string; warning: string } | null>(null);
  const [customPin, setCustomPin] = useState('');
  const [showCustomPin, setShowCustomPin] = useState(false);

  // Verification request state
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyRequesting, setVerifyRequesting] = useState(false);
  const [verifyRequested, setVerifyRequested] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const profiles: Profile[] = d.data ?? [];
          setAllProfiles(profiles);
          // Find personal profile — check explicit type first, then null/undefined (legacy), then any non-business
          const p = profiles.find(x => x.profile_type === 'personal')
            ?? profiles.find(x => !x.profile_type || x.profile_type !== 'business')
            ?? profiles[0]
            ?? null;
          if (p) {
            setProfile(p);
            loadProfileIntoForm(p);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load a profile's data into all form state
  function loadProfileIntoForm(p: Profile) {
    setForm({
      username: p.username || '',
      display_name: p.display_name || '',
      job_title: p.job_title || '',
      company: p.company || '',
      bio: p.bio || '',
      bio_html: p.bio_html || '',
      phone: p.phone || '',
      email: p.email || '',
      website: p.website || '',
      address: p.address || '',
      business_address: p.business_address || '',
      profile_photo: p.profile_photo || '',
      is_published: p.is_published,
      show_phone: p.show_phone,
      show_email: p.show_email,
      show_website: p.show_website,
      show_address: p.show_address,
      show_bio: p.show_bio,
      allow_indexing: p.allow_indexing ?? 0,
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
    });
    setUseHtmlBio(!!p.bio_html);
    setPublicPinEnabled(!!p.public_pin_enabled);
    // Load design/type fields
    const ext = p as unknown as Record<string, unknown>;
    if (typeof ext.personal_type === 'string') setPersonalType(ext.personal_type as PersonalTypeValue);
    if (typeof ext.layout_preset === 'string') setLayoutPreset(ext.layout_preset);
    if (typeof ext.colour_palette === 'string') setColourPalette(ext.colour_palette);
    if (typeof ext.custom_colour === 'string') setCustomColour(ext.custom_colour);
    if (typeof ext.button_style === 'string') setButtonStyle(ext.button_style);
    if (typeof ext.photo_shape === 'string') setPhotoShape(ext.photo_shape);
    // Load extended fields
    const parseArr = (v: unknown): string[] => {
      if (!v) return [];
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
      return Array.isArray(v) ? v : [];
    };
    const parseObjArr = (v: unknown) => {
      if (!v) return [];
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
      return Array.isArray(v) ? v : [];
    };
    setExtendedFields({
      headline:      typeof ext.headline      === 'string' ? ext.headline      : '',
      pronouns:      typeof ext.pronouns      === 'string' ? ext.pronouns      : '',
      location_city: typeof ext.location_city === 'string' ? ext.location_city : '',
      availability:  typeof ext.availability  === 'string' ? ext.availability  : '',
      portfolio_url: typeof ext.portfolio_url === 'string' ? ext.portfolio_url : '',
      skills:        parseArr(ext.skills),
      languages:     parseArr(ext.languages),
      awards:        parseArr(ext.awards),
      certifications:parseArr(ext.certifications),
      experience:    parseObjArr(ext.experience),
      education:     parseObjArr(ext.education),
      social_channels:  parseArr(ext.social_channels),
      content_niche:    typeof ext.content_niche   === 'string' ? ext.content_niche   : '',
      collab_rate:      typeof ext.collab_rate     === 'string' ? ext.collab_rate     : '',
      content_formats:  parseArr(ext.content_formats),
      platforms:        parseArr(ext.platforms),
      speaking_topics:  parseArr(ext.speaking_topics),
      coaching_areas:   parseArr(ext.coaching_areas),
      volunteer_causes: parseArr(ext.volunteer_causes),
      ministry_role:    typeof ext.ministry_role   === 'string' ? ext.ministry_role   : '',
      publications:     parseArr(ext.publications),
      gpa:              typeof ext.gpa             === 'string' ? ext.gpa             : '',
      graduation_year:  typeof ext.graduation_year === 'string' ? ext.graduation_year : '',
      internships:      parseArr(ext.internships),
      clubs:            parseArr(ext.clubs),
    });
  }

  // Switch to a different profile
  const switchProfile = (id: number) => {
    const p = allProfiles.find(x => x.id === id);
    if (!p || p.id === profile?.id) return;
    setProfile(p);
    setError('');
    setSaved(false);
    loadProfileIntoForm(p);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError('Photo must be under 2MB');
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, profile_photo: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      // Creating a new personal profile requires a username
      if (!profile && !form.username.trim()) {
        setError('Please enter a username for your profile URL before saving.');
        setSaving(false);
        return;
      }
      if (!profile && form.username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        setSaving(false);
        return;
      }

      // Safety net: if profile state is null but server has one, POST will return it via already_exists
      // If editing an existing profile use PUT; if creating a new personal profile use POST
      const url = profile ? `/api/profiles/${profile.id}` : '/api/profiles';
      const method = profile ? 'PUT' : 'POST';

      // For business profiles we only send the fields that are safe to update via this page
      // (the business-profile page owns the business-specific fields like business_name etc.)
      const isBusinessProfile = profile?.profile_type === 'business';

      const payload = isBusinessProfile
        ? {
            // Business profile: only update the shared personal-info fields
            display_name: form.display_name,
            job_title: form.job_title,
            company: form.company,
            bio: form.bio,
            bio_html: '',
            phone: form.phone,
            email: form.email,
            website: form.website,
            address: form.address,
            profile_photo: form.profile_photo,
            is_published: form.is_published,
            show_phone: form.show_phone,
            show_email: form.show_email,
            show_website: form.show_website,
            show_address: form.show_address,
            show_bio: form.show_bio,
            allow_indexing: form.allow_indexing,
            seo_title: form.seo_title,
            seo_description: form.seo_description,
          }
        : {
            // Personal profile: full payload
            ...form,
            bio: form.bio,
            bio_html: '',
            profile_type: 'personal',
            personal_type: personalType,
            layout_preset: layoutPreset,
            colour_palette: colourPalette,
            custom_colour: customColour,
            button_style: buttonStyle,
            photo_shape: photoShape,
            headline:      extendedFields.headline,
            pronouns:      extendedFields.pronouns,
            location_city: extendedFields.location_city,
            availability:  extendedFields.availability,
            portfolio_url: extendedFields.portfolio_url,
            skills:         JSON.stringify(extendedFields.skills),
            languages:      JSON.stringify(extendedFields.languages),
            awards:         JSON.stringify(extendedFields.awards),
            certifications: JSON.stringify(extendedFields.certifications),
            experience:     JSON.stringify(extendedFields.experience),
            education:      JSON.stringify(extendedFields.education),
            social_channels:  JSON.stringify(extendedFields.social_channels),
            content_niche:    extendedFields.content_niche,
            collab_rate:      extendedFields.collab_rate,
            content_formats:  JSON.stringify(extendedFields.content_formats),
            platforms:        JSON.stringify(extendedFields.platforms),
            speaking_topics:  JSON.stringify(extendedFields.speaking_topics),
            coaching_areas:   JSON.stringify(extendedFields.coaching_areas),
            volunteer_causes: JSON.stringify(extendedFields.volunteer_causes),
            ministry_role:    extendedFields.ministry_role,
            publications:     JSON.stringify(extendedFields.publications),
            gpa:              extendedFields.gpa,
            graduation_year:  extendedFields.graduation_year,
            internships:      JSON.stringify(extendedFields.internships),
            clubs:            JSON.stringify(extendedFields.clubs),
            business_address: form.business_address,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      let data: { success?: boolean; error?: string; data?: Profile };
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status} ${res.statusText}) — please try again`);
      }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      // Update the profile in state and in the allProfiles list
      const updated = data.data as Profile;
      setProfile(updated);
      loadProfileIntoForm(updated);
      setAllProfiles(prev => {
        const exists = prev.some(p => p.id === updated.id);
        return exists ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated];
      });
      // If the server told us a profile already existed (race condition / stale state), show a helpful message
      if ((data as any).already_exists) {
        setError('');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePublicPin = async (action: 'generate' | 'set' | 'clear', pin?: string) => {
    if (!profile) return;
    setPublicPinSaving(true);
    setPublicPinResult(null);
    try {
      const res = await fetch(`/api/profiles/${profile.id}/public-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, pin }),
      });
      const data = await res.json();
      if (data.success) {
        setPublicPinEnabled(data.enabled);
        if (data.pin) setPublicPinResult({ pin: data.pin, warning: data.warning });
        setCustomPin('');
      }
    } finally {
      setPublicPinSaving(false);
    }
  };

  const handleRequestVerification = async () => {
    if (!profile) return;
    setVerifyRequesting(true);
    setVerifyError('');
    try {
      const res = await fetch(`/api/profiles/${profile.id}/request-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: verifyNote }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyRequested(true);
        setVerifyNote('');
      } else {
        setVerifyError(data.error || 'Failed to submit request');
      }
    } catch {
      setVerifyError('Failed to submit request');
    } finally {
      setVerifyRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
      </div>
    );
  }
  // Free users can access and edit their personal profile — it is a core feature
  // of all plans including Free. The upgrade wall only applies to users with no
  // plan at all (hasNoActivePlan) who have not started a trial.
  const canAccessProfile = user?.hasFreeAccess || user?.hasStarterAccess || user?.hasBusinessAccess
    || user?.hasLifetimeAccess || user?.trialActive || user?.isSeatUser;
  if (!canAccessProfile) {
    return (
      <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
        <Helmet>
          <title>My Profile — Dashboard</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">Edit your public profile details</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Choose a plan to get started</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Select a plan — including the free plan — to create and publish your personal digital profile card. Start your free 30-day trial to unlock all features with no credit card required.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard/billing">
              <Button className="bg-primary gap-2 w-full sm:w-auto">
                <Zap className="w-4 h-4" /> Start free trial
              </Button>
            </Link>
            <Link to="/dashboard/billing">
              <Button variant="outline" className="border-border gap-2 w-full sm:w-auto">
                View plans <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">30 days free · No payment required · Cancel anytime</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>All Profiles — Dashboard</title>
        <meta name="description" content="Edit your personal and business profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/profile" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Inline Organisation Profile Editor ─────────────────────────────── */}
      {editingOrgId && (
        <div>
          <button
            onClick={() => setEditingOrg(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to All Profiles
          </button>
          <BusinessProfileDashboard profileId={editingOrgId} />
        </div>
      )}

      {/* ── Main All Profiles view ──────────────────────────────────────────── */}
      {!editingOrgId && (
      <div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Profiles</h1>
          <p className="text-muted-foreground mt-1">Manage your personal and organisation profiles</p>
        </div>
        <div className="flex gap-2 items-center">
          {profile && (
            <>
              <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                form.is_published
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${form.is_published ? 'bg-green-500' : 'bg-amber-500'}`} />
                {form.is_published ? 'Published' : 'Unpublished'}
              </span>
              <a
                href={form.is_published ? `/profile/${profile.username}` : `/api/profiles/${profile.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="border-border gap-2">
                  <ExternalLink className="w-4 h-4" />
                  {form.is_published ? 'View live' : 'Preview'}
                </Button>
              </a>
            </>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-primary gap-2">
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> {profile ? 'Save' : 'Create Profile'}</>}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — PERSONAL PROFILE
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Personal Profile</h2>
          <p className="text-xs text-muted-foreground">Your public digital business card</p>
        </div>
      </div>

      {!profile && !loading && (
        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-foreground">
          <p className="font-medium mb-1">
            {user?.isSeatUser ? 'Your free personal profile' : 'Set up your personal profile'}
          </p>
          <p className="text-muted-foreground">
            {user?.isSeatUser
              ? 'As a seat member you get a free personal digital business card. Fill in your details below and click Create Profile to publish it — completely separate from the business workspace.'
              : 'Fill in your details below and click Create Profile to publish your personal digital business card.'}
          </p>
        </div>
      )}

      {/* ── Profile Type Selector — personal profiles only ────────────── */}
      {profile?.profile_type !== 'business' && (
      <Card className="bg-card border-border mb-6">
        <button
          onClick={() => setShowTypeDesign(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary text-lg">{PERSONAL_TYPES.find(t => t.value === personalType)?.icon ?? '✨'}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Profile Type & Design</p>
              <p className="text-xs text-muted-foreground">{PERSONAL_TYPES.find(t => t.value === personalType)?.label ?? 'Choose your profile type'}</p>
            </div>
          </div>
          <span className="text-muted-foreground text-xs">{showTypeDesign ? '▲' : '▼'}</span>
        </button>

        {showTypeDesign && (
          <div className="px-5 pb-5 border-t border-border/50 space-y-6 pt-4">

            {/* Profile type grid */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">What best describes you?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERSONAL_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setPersonalType(pt.value)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      personalType === pt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-muted/10'
                    }`}
                  >
                    <span className="text-xl leading-none mt-0.5 flex-shrink-0">{pt.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${personalType === pt.value ? 'text-primary' : 'text-foreground'}`}>{pt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{pt.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
              {personalType && (
                <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">{TYPE_CONFIG[personalType].headline}</p>
                  <p>{TYPE_CONFIG[personalType].jobTitleLabel} suggestion: <span className="text-foreground">{TYPE_CONFIG[personalType].jobTitleHint}</span></p>
                  <p>Bio tip: <span className="text-foreground">{TYPE_CONFIG[personalType].bioHint}</span></p>
                </div>
              )}
            </div>

            {/* Layout preset */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4 text-primary" />Layout preset</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PERSONAL_LAYOUT_PRESETS.map(lp => (
                  <button
                    key={lp.value}
                    type="button"
                    onClick={() => setLayoutPreset(lp.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      layoutPreset === lp.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className={`text-sm font-medium ${layoutPreset === lp.value ? 'text-primary' : 'text-foreground'}`}>{lp.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{lp.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Colour palette */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Colour palette</p>
              <div className="flex flex-wrap gap-2">
                {PERSONAL_COLOUR_PALETTES.map(cp => (
                  <button
                    key={cp.value}
                    type="button"
                    onClick={() => setColourPalette(cp.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                      colourPalette === cp.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {cp.value !== 'custom' && (
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cp.primary }} />
                    )}
                    <span className={colourPalette === cp.value ? 'text-primary font-medium' : 'text-foreground'}>{cp.label}</span>
                  </button>
                ))}
              </div>
              {colourPalette === 'custom' && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">Custom colour</label>
                  <input type="color" value={customColour} onChange={e => setCustomColour(e.target.value)}
                    className="w-10 h-8 rounded border border-border cursor-pointer bg-background" />
                  <span className="text-xs font-mono text-muted-foreground">{customColour}</span>
                </div>
              )}
            </div>

            {/* Button style */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Button style</p>
              <div className="flex flex-wrap gap-2">
                {PERSONAL_BUTTON_STYLES.map(bs => (
                  <button
                    key={bs.value}
                    type="button"
                    onClick={() => setButtonStyle(bs.value)}
                    className={`px-4 py-2 border text-sm transition-all ${bs.preview} ${
                      buttonStyle === bs.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:border-primary/40'
                    }`}
                  >
                    {bs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo shape */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Profile photo shape</p>
              <div className="flex gap-3">
                {PHOTO_SHAPES.map(ps => (
                  <button
                    key={ps.value}
                    type="button"
                    onClick={() => setPhotoShape(ps.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      photoShape === ps.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-10 h-10 bg-primary/30 ${ps.preview} overflow-hidden flex items-center justify-center`}>
                      {form.profile_photo
                        ? <img src={form.profile_photo} alt="" className="w-full h-full object-cover" />
                        : <span className="text-primary font-bold text-sm">{(form.display_name || 'U').charAt(0)}</span>
                      }
                    </div>
                    <span className={`text-xs font-medium ${photoShape === ps.value ? 'text-primary' : 'text-foreground'}`}>{ps.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </Card>
      )} {/* end personal-only Profile Type Selector */}

      {/* Photo */}
      <Card className="bg-card border-border mb-6">
        <CardHeader><CardTitle className="text-base">Profile Photo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.profile_photo ? (
                <img src={form.profile_photo} alt="Profile"
                  className={`w-20 h-20 object-cover border-2 border-border ${PHOTO_SHAPES.find(s => s.value === photoShape)?.preview ?? 'rounded-full'}`} />
              ) : (
                <div className={`w-20 h-20 bg-primary/20 flex items-center justify-center border-2 border-border ${PHOTO_SHAPES.find(s => s.value === photoShape)?.preview ?? 'rounded-full'}`}>
                  <span className="text-primary font-bold text-2xl">{(form.display_name || user?.name || 'U').charAt(0)}</span>
                </div>
              )}
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">Upload profile photo or headshot</p>
              <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG or GIF. Max 2 MB.</p>
              <p className="text-xs text-muted-foreground">Recommended: <span className="font-medium text-foreground">800 × 800 px</span> square image for best results.</p>
              <p className="text-xs text-muted-foreground">Minimum 200 × 200 px. Images smaller than this may appear blurry.</p>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline">Choose file</button>
                {form.profile_photo && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, profile_photo: '' }))}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      {profile && profile.profile_type !== 'business' && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-base">Export Your Profile</CardTitle>
            <CardDescription>Download or print your digital business card</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileExport
              profile={form}
              profileUrl={`${branding.platform_url}/profile/${form.username}`}
              variant="personal"
            />
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
          <CardDescription>
            Your public profile URL:{' '}
            <span className="text-primary font-mono text-xs">
              {new URL(branding.platform_url).hostname}/profile/
              {profile?.profile_type === 'business' && profile.biz_slug
                ? profile.biz_slug
                : form.username || '…'}
            </span>
            {profile && !form.is_published && (
              <span className="ml-2 text-xs text-amber-500 font-normal">(unpublished — only you can see it)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Username field — personal profiles only; organisation profiles use biz_slug (set on Organisation Profile page) */}
          {profile?.profile_type !== 'business' && (
          <div>
            <Label>Username (your profile URL)</Label>
            <div className="flex mt-1.5">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-muted-foreground text-sm">
                {new URL(branding.platform_url).hostname}/profile/
              </span>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="rounded-l-none bg-background border-border" placeholder="yourname" />
            </div>
            {!profile && !form.username && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> A username is required to create your profile — this becomes your public URL.
              </p>
            )}
          </div>
          )}
          {profile?.profile_type === 'business' && (
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Your business profile URL is set by the <strong>Business Slug</strong> on the{' '}
              <a href="/dashboard/organisation-profile" className="text-primary underline underline-offset-2 hover:no-underline">Organisation Profile page</a>.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Display Name</Label>
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="mt-1.5 bg-background border-border" placeholder="Alex Johnson" />
            </div>
            <div>
              <Label>{profile?.profile_type === 'business' ? 'Job Title / Role' : TYPE_CONFIG[personalType].jobTitleLabel}</Label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                className="mt-1.5 bg-background border-border" placeholder={profile?.profile_type === 'business' ? 'e.g. Owner / Manager' : TYPE_CONFIG[personalType].jobTitleHint} />
            </div>
          </div>
          <div>
            <Label>{profile?.profile_type === 'business' ? 'Company / Organisation' : TYPE_CONFIG[personalType].companyLabel}</Label>
            <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="mt-1.5 bg-background border-border" placeholder={profile?.profile_type === 'business' ? 'Trading name or parent company' : TYPE_CONFIG[personalType].companyHint} />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              className="mt-1.5 bg-background border-border resize-none" rows={3}
              placeholder={TYPE_CONFIG[personalType].bioHint} />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base">Contact Details</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Use the toggle to control which fields are visible on your public profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'phone', label: 'Phone', placeholder: '+44 7700 900123', showKey: 'show_phone' },
            { key: 'email', label: 'Email', placeholder: 'you@example.com', showKey: 'show_email' },
            { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com', showKey: 'show_website' },
            { key: 'address', label: 'Home / Location', placeholder: 'London, UK', showKey: 'show_address' },
          ].map(field => (
            <div key={field.key} className="flex items-center gap-3">
              <div className="flex-1">
                <Label>{field.label}</Label>
                <Input value={form[field.key as keyof typeof form] as string}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="mt-1.5 bg-background border-border" placeholder={field.placeholder} />
              </div>
              <div className="flex flex-col items-center gap-1 pt-6">
                <Switch
                  checked={!!form[field.showKey as keyof typeof form]}
                  onCheckedChange={v => setForm(f => ({ ...f, [field.showKey]: v ? 1 : 0 }))}
                />
                <span className="text-xs text-muted-foreground">Show</span>
              </div>
            </div>
          ))}

          {/* Business address — shown for professional/business-owner profile types */}
          <div className="pt-2 border-t border-border">
            <Label>Business Address <span className="text-muted-foreground font-normal text-xs">(optional — for professionals & business owners)</span></Label>
            <Input
              value={form.business_address}
              onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))}
              className="mt-1.5 bg-background border-border"
              placeholder="123 High Street, London, EC1A 1BB"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If set, this address is shown on your profile as your business or office address. Leave blank to hide it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card className="bg-card border-border mb-6">
        <CardHeader><CardTitle className="text-base">Visibility Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Published</p>
              <p className="text-xs text-muted-foreground">Make your profile visible to the public</p>
            </div>
            <Switch checked={!!form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v ? 1 : 0 }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Show Bio</p>
              <p className="text-xs text-muted-foreground">Display your bio on your public profile</p>
            </div>
            <Switch checked={!!form.show_bio} onCheckedChange={v => setForm(f => ({ ...f, show_bio: v ? 1 : 0 }))} />
          </div>
        </CardContent>
      </Card>

      {/* Extended Profile Info — type-aware */}
      {(() => {
        const cfg = TYPE_CONFIG[personalType];
        const s = cfg.sections;
        const hasAnything = Object.values(s).some(Boolean);
        if (!hasAnything) return null;
        return (
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-base">Profile Details</CardTitle>
              <CardDescription>
                {personalType === 'content_creator' && 'Add your channels, niche, and skills — tailored for creators.'}
                {personalType === 'faith' && 'Share your ministry role and the community you serve.'}
                {personalType === 'volunteer' && 'Tell people about the causes you support.'}
                {personalType === 'nonprofit' && 'Describe your organisation\'s mission and your role.'}
                {personalType === 'speaker' && 'Add your speaking topics, experience, and publications.'}
                {personalType === 'coach' && 'Describe your coaching areas, certifications, and experience.'}
                {personalType === 'student' && 'Add your skills, education, and what you\'re looking for.'}
                {!['content_creator','faith','volunteer','nonprofit','speaker','coach','student'].includes(personalType) && 'Add more depth to your profile — all fields are optional.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Headline */}
              {s.headline && (
                <div>
                  <Label>Headline <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={extendedFields.headline}
                    onChange={e => setExtendedFields(f => ({ ...f, headline: e.target.value }))}
                    className="mt-1.5 bg-background border-border"
                    placeholder={
                      personalType === 'content_creator' ? 'e.g. Helping 100k+ people travel smarter' :
                      personalType === 'speaker' ? 'e.g. Inspiring leaders to think differently' :
                      personalType === 'coach' ? 'e.g. Helping executives unlock their potential' :
                      personalType === 'faith' ? 'e.g. Serving our community with love and purpose' :
                      'e.g. Helping startups scale with great design'
                    }
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground mt-1">A short punchy line below your name. Max 120 characters.</p>
                </div>
              )}

              {/* Pronouns + Location */}
              {(s.pronouns || s.location) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {s.pronouns && (
                    <div>
                      <Label>Pronouns <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.pronouns}
                        onChange={e => setExtendedFields(f => ({ ...f, pronouns: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder="e.g. she/her, he/him, they/them"
                        maxLength={40}
                      />
                    </div>
                  )}
                  {s.location && (
                    <div>
                      <Label>City / Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.location_city}
                        onChange={e => setExtendedFields(f => ({ ...f, location_city: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder="e.g. London, UK"
                        maxLength={80}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Availability + Portfolio URL */}
              {(s.availability || s.portfolioUrl) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {s.availability && (
                    <div>
                      <Label>Availability <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.availability}
                        onChange={e => setExtendedFields(f => ({ ...f, availability: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder={
                          personalType === 'freelancer' ? 'e.g. Available from September' :
                          personalType === 'student' ? 'e.g. Open to internships' :
                          'e.g. Open to freelance, Available from Sept'
                        }
                        maxLength={80}
                      />
                    </div>
                  )}
                  {s.portfolioUrl && (
                    <div>
                      <Label>Portfolio / Website URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.portfolio_url}
                        onChange={e => setExtendedFields(f => ({ ...f, portfolio_url: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder="https://yourportfolio.com"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Content Creator: Social Channels */}
              {s.socialChannels && (
                <SkillsEditor
                  label="Social Channels & Links"
                  placeholder="e.g. YouTube: @yourchannel, Instagram: @yourhandle"
                  hint="Add your social media channels and handles. Press Enter or comma to add each one."
                  value={extendedFields.social_channels}
                  onChange={v => setExtendedFields(f => ({ ...f, social_channels: v }))}
                />
              )}

              {/* Content Creator: Content Niche */}
              {s.contentNiche && (
                <div>
                  <Label>Content Niche <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={extendedFields.content_niche}
                    onChange={e => setExtendedFields(f => ({ ...f, content_niche: e.target.value }))}
                    className="mt-1.5 bg-background border-border"
                    placeholder="e.g. Travel, Lifestyle, Tech Reviews, Gaming"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Describe your content niche or the topics you cover.</p>
                </div>
              )}

              {/* Content Creator: Platforms */}
              {s.platforms && (
                <SkillsEditor
                  label="Platforms"
                  placeholder="e.g. YouTube, Instagram, TikTok, Twitch, Substack"
                  hint="Which platforms do you create content on? Press Enter or comma to add each one."
                  value={extendedFields.platforms}
                  onChange={v => setExtendedFields(f => ({ ...f, platforms: v }))}
                />
              )}

              {/* Content Creator: Content Formats */}
              {s.contentFormats && (
                <SkillsEditor
                  label="Content Formats"
                  placeholder="e.g. Long-form video, Short-form reels, Podcasts, Blog posts"
                  hint="What types of content do you produce? Press Enter or comma to add each one."
                  value={extendedFields.content_formats}
                  onChange={v => setExtendedFields(f => ({ ...f, content_formats: v }))}
                />
              )}

              {/* Content Creator: Collab Rate */}
              {s.collabRate && (
                <div>
                  <Label>Brand Collaboration Rate <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={extendedFields.collab_rate}
                    onChange={e => setExtendedFields(f => ({ ...f, collab_rate: e.target.value }))}
                    className="mt-1.5 bg-background border-border"
                    placeholder="e.g. From £500/post, DM for rates, Open to gifting"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Shown on your public profile to help brands understand your rates.</p>
                </div>
              )}

              {/* Speaker: Speaking Topics */}
              {s.speakingTopics && (
                <SkillsEditor
                  label="Speaking Topics"
                  placeholder="e.g. Leadership, AI & the Future, Mental Health at Work"
                  hint="Add the topics you speak on. Press Enter or comma to add each one."
                  value={extendedFields.speaking_topics}
                  onChange={v => setExtendedFields(f => ({ ...f, speaking_topics: v }))}
                />
              )}

              {/* Coach: Coaching Areas */}
              {s.coachingAreas && (
                <SkillsEditor
                  label="Coaching Areas"
                  placeholder="e.g. Executive Leadership, Career Transitions, Work-Life Balance"
                  hint="Add the areas you coach in. Press Enter or comma to add each one."
                  value={extendedFields.coaching_areas}
                  onChange={v => setExtendedFields(f => ({ ...f, coaching_areas: v }))}
                />
              )}

              {/* Volunteer / Nonprofit: Causes */}
              {s.volunteerCauses && (
                <SkillsEditor
                  label={personalType === 'nonprofit' ? 'Causes & Focus Areas' : 'Causes You Support'}
                  placeholder="e.g. Homelessness, Youth Empowerment, Climate Action"
                  hint="Add the causes or focus areas. Press Enter or comma to add each one."
                  value={extendedFields.volunteer_causes}
                  onChange={v => setExtendedFields(f => ({ ...f, volunteer_causes: v }))}
                />
              )}

              {/* Faith: Ministry Role */}
              {s.ministryRole && (
                <div>
                  <Label>Ministry Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    value={extendedFields.ministry_role}
                    onChange={e => setExtendedFields(f => ({ ...f, ministry_role: e.target.value }))}
                    className="mt-1.5 bg-background border-border resize-none"
                    rows={3}
                    placeholder="e.g. Serving as Senior Pastor at Grace Community Church, leading Sunday worship and pastoral care for our congregation of 200."
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Describe your ministry, calling, or role in your faith community. Max 500 characters.</p>
                </div>
              )}

              {/* Skills */}
              {s.skills && (
                <SkillsEditor
                  label={personalType === 'content_creator' ? 'Skills & Tools' : personalType === 'student' ? 'Skills & Interests' : 'Skills'}
                  placeholder={
                    personalType === 'content_creator' ? 'e.g. Video Editing, Photography, SEO' :
                    personalType === 'freelancer' ? 'e.g. React, Figma, Project Management' :
                    personalType === 'student' ? 'e.g. Python, Data Analysis, Public Speaking' :
                    'e.g. React, Figma, Project Management'
                  }
                  hint="Add your key skills. Press Enter or comma to add each one."
                  value={extendedFields.skills}
                  onChange={v => setExtendedFields(f => ({ ...f, skills: v }))}
                />
              )}

              {/* Languages */}
              {s.languages && (
                <SkillsEditor
                  label="Languages"
                  placeholder="e.g. English (Native), French (Conversational)"
                  hint="Languages you speak."
                  value={extendedFields.languages}
                  onChange={v => setExtendedFields(f => ({ ...f, languages: v }))}
                />
              )}

              {/* Awards */}
              {s.awards && (
                <SkillsEditor
                  label={personalType === 'content_creator' ? 'Awards & Milestones' : 'Awards & Recognition'}
                  placeholder={
                    personalType === 'content_creator' ? 'e.g. 100k Subscribers, YouTube Silver Play Button' :
                    'e.g. Best Designer 2024, Forbes 30 Under 30'
                  }
                  hint="Notable awards, recognition, or achievements."
                  value={extendedFields.awards}
                  onChange={v => setExtendedFields(f => ({ ...f, awards: v }))}
                />
              )}

              {/* Certifications */}
              {s.certifications && (
                <SkillsEditor
                  label="Certifications & Qualifications"
                  placeholder={
                    personalType === 'coach' ? 'e.g. ICF Certified Coach, NLP Practitioner' :
                    personalType === 'student' ? 'e.g. Google Analytics, AWS Cloud Practitioner' :
                    'e.g. AWS Certified, Google Analytics, PMP'
                  }
                  hint="Professional certifications and qualifications."
                  value={extendedFields.certifications}
                  onChange={v => setExtendedFields(f => ({ ...f, certifications: v }))}
                />
              )}

              {/* Publications */}
              {s.publications && (
                <SkillsEditor
                  label={personalType === 'speaker' ? 'Books & Publications' : 'Publications'}
                  placeholder="e.g. The Leadership Code (2023), Harvard Business Review"
                  hint="Books, articles, or other publications you have authored."
                  value={extendedFields.publications}
                  onChange={v => setExtendedFields(f => ({ ...f, publications: v }))}
                />
              )}

              {/* Student: GPA + Graduation Year */}
              {(s.gpa || s.graduationYear) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {s.graduationYear && (
                    <div>
                      <Label>Expected Graduation Year <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.graduation_year}
                        onChange={e => setExtendedFields(f => ({ ...f, graduation_year: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder="e.g. 2026"
                        maxLength={10}
                      />
                    </div>
                  )}
                  {s.gpa && (
                    <div>
                      <Label>GPA / Grade <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={extendedFields.gpa}
                        onChange={e => setExtendedFields(f => ({ ...f, gpa: e.target.value }))}
                        className="mt-1.5 bg-background border-border"
                        placeholder="e.g. 3.8/4.0, First Class, 2:1"
                        maxLength={30}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Student: Internships */}
              {s.internships && (
                <SkillsEditor
                  label="Internships & Work Experience"
                  placeholder="e.g. Software Intern @ Google (Summer 2025)"
                  hint="Add internships or part-time roles. Press Enter or comma to add each one."
                  value={extendedFields.internships}
                  onChange={v => setExtendedFields(f => ({ ...f, internships: v }))}
                />
              )}

              {/* Student: Clubs & Societies */}
              {s.clubs && (
                <SkillsEditor
                  label="Clubs & Societies"
                  placeholder="e.g. Robotics Society, Debate Club, Student Union"
                  hint="Clubs, societies, or extracurricular activities."
                  value={extendedFields.clubs}
                  onChange={v => setExtendedFields(f => ({ ...f, clubs: v }))}
                />
              )}

              {/* Experience */}
              {s.experience && (
                <ExperienceEditor
                  label={
                    personalType === 'volunteer' ? 'Volunteer Experience' :
                    personalType === 'nonprofit' ? 'Roles & Experience' :
                    personalType === 'speaker' ? 'Speaking Experience' :
                    personalType === 'coach' ? 'Coaching & Career Experience' :
                    'Work Experience'
                  }
                  value={extendedFields.experience}
                  onChange={v => setExtendedFields(f => ({ ...f, experience: v }))}
                />
              )}

              {/* Education */}
              {s.education && (
                <ExperienceEditor
                  label={
                    personalType === 'faith' ? 'Theological Training & Education' :
                    personalType === 'student' ? 'Education' :
                    'Education'
                  }
                  isEducation
                  value={extendedFields.education}
                  onChange={v => setExtendedFields(f => ({ ...f, education: v }))}
                />
              )}

            </CardContent>
          </Card>
        );
      })()}

      {/* Feature toggles — saved separately via PATCH, not part of the main profile save */}
      {profile && <ProfileFeatureToggles profileId={profile.id} />}

      {/* Public Profile PIN Lock */}
      {profile && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Public Profile PIN Lock</CardTitle>
            </div>
            <CardDescription>
              Protect your public profile with a PIN. Visitors must enter the correct PIN to view your card.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center gap-2">
                {publicPinEnabled
                  ? <Lock className="w-4 h-4 text-blue-400" />
                  : <Eye className="w-4 h-4 text-green-400" />}
                <span className="text-sm font-medium text-foreground">
                  {publicPinEnabled ? 'Profile is PIN-locked' : 'Profile is publicly accessible'}
                </span>
              </div>
              {publicPinEnabled && (
                <button
                  onClick={() => handlePublicPin('clear')}
                  disabled={publicPinSaving}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove PIN
                </button>
              )}
            </div>

            {/* Generated PIN display — shown once */}
            {publicPinResult && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm font-semibold text-blue-400 mb-1 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> Your PIN — save this now
                </p>
                <p className="text-3xl font-mono font-bold text-foreground tracking-widest mb-2">{publicPinResult.pin}</p>
                <p className="text-xs text-muted-foreground">{publicPinResult.warning}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-border gap-2"
                onClick={() => handlePublicPin('generate')}
                disabled={publicPinSaving}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {publicPinEnabled ? 'Regenerate PIN' : 'Generate PIN'}
              </Button>

              <button
                type="button"
                onClick={() => setShowCustomPin(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {showCustomPin ? 'Hide' : 'Set my own PIN'}
              </button>
            </div>

            {showCustomPin && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Custom PIN (4–8 digits)</Label>
                  <div className="relative mt-1">
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={customPin}
                      onChange={e => setCustomPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="bg-background border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                        if (input) input.type = input.type === 'password' ? 'text' : 'password';
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-primary"
                  onClick={() => handlePublicPin('set', customPin)}
                  disabled={publicPinSaving || customPin.length < 4}
                >
                  Set PIN
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              The PIN is stored securely as a one-way hash. If you forget it, generate a new one.
            </p>
          </CardContent>
        </Card>
      )}

      {/* SEO & Search Engine Visibility */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Search Engine Visibility</CardTitle>
          </div>
          <CardDescription>Control how search engines like Google see your profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SEO Status Checker */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
            <p className="text-xs font-semibold text-foreground mb-2">SEO Status</p>
            {[
              {
                label: 'Profile is published',
                ok: !!form.is_published,
                failMsg: 'Your profile is not published — it is invisible to everyone including search engines.',
              },
              {
                label: 'Search engine indexing enabled',
                ok: !!form.allow_indexing,
                failMsg: 'Indexing is off — Google cannot find this profile.',
              },
              {
                label: 'Has a public URL (username)',
                ok: !!(form as { username?: string }).username,
                failMsg: 'No username set — profile has no public URL.',
              },
              {
                label: 'Has a display name',
                ok: !!form.display_name?.trim(),
                failMsg: 'No display name — search results will show a blank title.',
              },
              {
                label: 'Has a bio or SEO description',
                ok: !!(form.bio?.trim() || form.seo_description?.trim()),
                failMsg: 'No bio or SEO description — search results will have no description.',
              },
            ].map(({ label, ok, failMsg }) => (
              <div key={label} className="flex items-start gap-2">
                <span className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold ${ok ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {ok ? '✓' : '!'}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${ok ? 'text-green-400' : 'text-blue-400'}`}>{label}</p>
                  {!ok && <p className="text-xs text-muted-foreground mt-0.5">{failMsg}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Allow search engines to index this profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.allow_indexing
                  ? <span className="text-green-400">Visible to Google and other search engines</span>
                  : <span className="text-blue-400">Hidden from search engines (noindex)</span>}
              </p>
            </div>
            <Switch
              checked={!!form.allow_indexing}
              onCheckedChange={v => setForm(f => ({ ...f, allow_indexing: v ? 1 : 0 }))}
            />
          </div>
          {!!form.allow_indexing && (
            <>
              <div>
                <Label>SEO Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.seo_title}
                  onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                  className="mt-1.5 bg-background border-border"
                  placeholder={`${form.display_name || 'Your Name'}${form.job_title ? ` — ${form.job_title}` : ''}`}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.seo_title.length}/60 characters. Leave blank to use your name and job title.</p>
              </div>
              <div>
                <Label>SEO Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={form.seo_description}
                  onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                  className="mt-1.5 bg-background border-border resize-none"
                  rows={3}
                  placeholder={form.bio || 'Describe yourself for search engines...'}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.seo_description.length}/160 characters. Leave blank to use your bio.</p>
              </div>
            </>
          )}
          {!form.allow_indexing && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
              <Search className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Your profile is hidden from Google. It can still be accessed via direct link or QR code.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-primary gap-2">
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> {profile ? 'Save Profile' : 'Create Profile'}</>}
        </Button>
      </div>

      {/* ── Verification request ─────────────────────────────────────────── */}
      {profile && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              Profile Verification
            </CardTitle>
            <CardDescription>
              Request a verified badge for your profile. Our team will review your request and verify your identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.is_verified ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <BadgeCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Your profile is verified</p>
                  {profile.verified_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified on {fmtDate(profile.verified_at, 'long')}
                    </p>
                  )}
                </div>
              </div>
            ) : profile.verification_requested_at || verifyRequested ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Verification request submitted</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Our team will review your request. You will be notified once a decision has been made.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A verified badge shows visitors that your profile has been reviewed and confirmed by the Profile Centre team.
                </p>
                <div>
                  <Label htmlFor="verify-note">Why should your profile be verified? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="verify-note"
                    value={verifyNote}
                    onChange={e => setVerifyNote(e.target.value)}
                    className="mt-1.5 bg-background border-border resize-none"
                    rows={3}
                    placeholder="e.g. I am a registered business, professional, or public figure..."
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{verifyNote.length}/500 characters</p>
                </div>
                {verifyError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {verifyError}
                  </div>
                )}
                <Button
                  onClick={handleRequestVerification}
                  disabled={verifyRequesting}
                  variant="outline"
                  className="gap-2"
                >
                  <BadgeCheck className="w-4 h-4" />
                  {verifyRequesting ? 'Submitting...' : 'Request Verification'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Profile feature tabs (WhatsApp, Social, Gallery, Menu, PDF) ─── */}
      {profile && (
        <ProfileFeatureTabs
          profile={profile as Parameters<typeof ProfileFeatureTabs>[0]['profile']}
          onSaved={updated => {
            setProfile(prev => prev ? { ...prev, ...updated } : prev);
            setAllProfiles(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — ORGANISATION PROFILES
      ══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const orgProfiles = allProfiles.filter(p => p.profile_type === 'business');
        const orgCount = orgProfiles.length;
        // Use max_org_profiles from the user's plan — the single source of truth from the DB.
        // This correctly distinguishes Organisation (1), Ultimate Organisation (4),
        // Ultimate Organisation+ (10), and Free/Starter (0).
        const maxOrgSlots = (user as unknown as Record<string, unknown>)?.max_org_profiles as number ?? 0;
        const remaining = Math.max(0, maxOrgSlots - orgCount);
        const canAddMore = remaining > 0;

        return (
          <div className="mt-12 pt-8 border-t border-border" id="org-profiles">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Organisation Profiles</h2>
                  <p className="text-xs text-muted-foreground">
                    {maxOrgSlots > 0
                      ? `${orgCount} of ${maxOrgSlots} profile${maxOrgSlots !== 1 ? 's' : ''} used`
                      : 'Available on Professional plan and above'}
                  </p>
                </div>
              </div>
              {/* Add another button — shown when slots remain and at least one profile exists */}
              {canAddMore && orgCount > 0 && (
                <Button size="sm" className="bg-primary gap-1.5 flex-shrink-0" onClick={() => setEditingOrg('new')}>
                  <Plus className="w-3.5 h-3.5" /> Add organisation
                </Button>
              )}
            </div>

            {/* Gate: free / starter — show upgrade prompt */}
            {maxOrgSlots === 0 && !user?.trialActive ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto">
                  <Building2 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Organisation profiles from Professional</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Upgrade to Professional or above to create a dedicated organisation page with your brand, services, opening hours, team, and more.
                  </p>
                </div>
                <a href="/dashboard/billing">
                  <Button size="sm" className="bg-primary gap-2 mt-1">
                    <Zap className="w-3.5 h-3.5" /> View plans
                  </Button>
                </a>
              </div>
            ) : (
              /* Professional+ — show organisation profile cards */
              <div className="space-y-3">
                {/* Existing organisation profiles */}
                {orgProfiles.map((bp, idx) => {
                  const bizName = (bp as unknown as Record<string, unknown>).business_name as string | undefined;
                  const bizSlug = (bp as unknown as Record<string, unknown>).biz_slug as string | undefined;
                  const isPublished = !!(bp as unknown as Record<string, unknown>).is_published;
                  const profileUrl = bizSlug ? `/profile/${bizSlug}` : null;
                  return (
                    <div key={bp.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {bizName || bp.display_name || `Organisation Profile ${idx + 1}`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              isPublished
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${isPublished ? 'bg-green-500' : 'bg-amber-500'}`} />
                              {isPublished ? 'Published' : 'Unpublished'}
                            </span>
                            {bizSlug && (
                              <span className="text-[10px] text-muted-foreground truncate">/profile/{bizSlug}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* QR code quick-link */}
                        {profileUrl && (
                          <a href="/dashboard/qr-code" title="View QR code">
                            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground px-2">
                              <QrCode className="w-4 h-4" />
                              <span className="hidden sm:inline text-xs">QR</span>
                            </Button>
                          </a>
                        )}
                        {/* View live */}
                        {isPublished && profileUrl && (
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View live profile">
                            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground px-2">
                              <ExternalLink className="w-4 h-4" />
                              <span className="hidden sm:inline text-xs">View</span>
                            </Button>
                          </a>
                        )}
                        <button onClick={() => setEditingOrg(String(bp.id))}>
                          <Button size="sm" variant="outline" className="border-border gap-1.5">
                            Edit <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* No organisation profile yet — prompt to create */}
                {orgCount === 0 && (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-border bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">No organisation profile yet</p>
                        <p className="text-xs text-muted-foreground">Create your first organisation profile</p>
                      </div>
                    </div>
                    <button onClick={() => setEditingOrg('new')} className="flex-shrink-0">
                      <Button size="sm" className="bg-primary gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Create
                      </Button>
                    </button>
                  </div>
                )}

                {/* Remaining slots info + add button */}
                {canAddMore && orgCount > 0 && (
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {remaining} more slot{remaining !== 1 ? 's' : ''} available on your plan.
                      </span>
                    </div>
                    <button onClick={() => setEditingOrg('new')} className="flex-shrink-0">
                      <Button size="sm" className="bg-primary gap-1.5 h-7 text-xs">
                        <Plus className="w-3 h-3" /> Add another
                      </Button>
                    </button>
                  </div>
                )}

                {/* All slots used */}
                {!canAddMore && orgCount >= maxOrgSlots && maxOrgSlots > 0 && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    All {maxOrgSlots} organisation profile slot{maxOrgSlots !== 1 ? 's' : ''} used.
                    {maxOrgSlots < 10 && (
                      <a href="/dashboard/billing" className="text-primary underline underline-offset-2 ml-1">Upgrade for more.</a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
      </div>
      )} {/* end !editingOrgId */}
    </div>
  );
}
