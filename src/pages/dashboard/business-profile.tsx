/**
 * Dashboard — Organisation Profile Editor
 * /dashboard/organisation-profile
 *
 * Lets the organisation owner edit all fields of their organisation profile:
 * name, tagline, description, category, contact details, opening hours,
 * services/products, team members, announcements, social links, logo/cover.
 */
import { useState, useEffect, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Save, Check, ExternalLink, Plus, Trash2, Camera, Building2,
  ChevronDown, ChevronUp, Clock, Briefcase, Users,
  Globe, Phone, Mail, MapPin, Lock, Unlock, Search,
  GalleryHorizontal, Award, CircleHelp, Star, Link2, Palette,
  MessageSquareQuote, MousePointerClick, CreditCard as CreditCardIcon,
  Sparkles, CalendarCheck, CheckCircle2, ArrowRight,
} from 'lucide-react';
import ProfileExport from '@/components/ProfileExport';

// ─── Types ────────────────────────────────────────────────────────────────

interface Service { name: string; description: string; price: string; category: string; }
interface TeamMember { name: string; role: string; bio: string; photo: string; email: string; linkedin: string; }
interface Announcement { title: string; body: string; date: string; tag: string; }
interface SocialLink { platform: string; label: string; url: string; }
interface GalleryItem { url: string; caption: string; type: 'image' | 'video'; }
interface Award { title: string; issuer: string; year: string; description: string; }
interface FaqItem { question: string; answer: string; }
interface Certification { name: string; issuer: string; year: string; url: string; }
interface Testimonial { name: string; role: string; body: string; rating: number; }
interface CtaButton { label: string; url: string; style: 'primary' | 'secondary' | 'outline'; }
interface PaymentMethod { name: string; }

// ─── Business type config ─────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'local_service',   label: 'Local Service Business', icon: '🏠', hint: 'Plumber, electrician, cleaner, handyman, etc.' },
  { value: 'consultant',      label: 'Consultant',             icon: '💼', hint: 'Business, strategy, HR, finance, IT consulting' },
  { value: 'freelancer',      label: 'Freelancer',             icon: '🎯', hint: 'Independent contractor or self-employed professional' },
  { value: 'tradesperson',    label: 'Tradesperson',           icon: '🔧', hint: 'Builder, carpenter, electrician, plumber, decorator' },
  { value: 'restaurant',      label: 'Restaurant / Café',      icon: '🍽️', hint: 'Restaurant, café, takeaway, food truck, catering' },
  { value: 'barber_salon',    label: 'Barber / Salon',         icon: '✂️', hint: 'Barbershop, hair salon, nail studio, beauty salon' },
  { value: 'beauty',          label: 'Beauty / Wellness',      icon: '💆', hint: 'Spa, massage, yoga, holistic therapy, wellness studio' },
  { value: 'healthcare',      label: 'Healthcare / Clinic',    icon: '🏥', hint: 'Private clinic, dentist, physio, optician, therapist' },
  { value: 'real_estate',     label: 'Real Estate / Property', icon: '🏡', hint: 'Estate agent, letting agent, property developer' },
  { value: 'retail',          label: 'Retail / Shop',          icon: '🛍️', hint: 'Physical or online shop, boutique, market stall' },
  { value: 'education',       label: 'Education / Training',   icon: '🎓', hint: 'Tutor, trainer, coach, school, academy, e-learning' },
  { value: 'events',          label: 'Event / Wedding Business', icon: '🎉', hint: 'Event planner, wedding coordinator, venue, DJ, photographer' },
  { value: 'creative_agency', label: 'Creative Agency',        icon: '🎨', hint: 'Design, marketing, branding, advertising, PR agency' },
  { value: 'technology',      label: 'Technology / SaaS',      icon: '💻', hint: 'Software company, app developer, IT services, SaaS' },
  { value: 'nonprofit',       label: 'Non-profit / Community', icon: '🤝', hint: 'Charity, CIC, community group, social enterprise' },
  { value: 'other',           label: 'Other',                  icon: '⚡', hint: 'Flexible layout for any other business type' },
] as const;

type BusinessTypeValue = typeof BUSINESS_TYPES[number]['value'];

// Sections suggested per business type (shown with a "recommended" badge)
const TYPE_SUGGESTED_SECTIONS: Record<BusinessTypeValue, string[]> = {
  local_service:   ['contact', 'services', 'hours', 'certifications', 'gallery', 'faqs', 'map'],
  consultant:      ['services', 'team', 'certifications', 'faqs', 'social', 'cta'],
  freelancer:      ['services', 'gallery', 'faqs', 'social', 'cta'],
  tradesperson:    ['contact', 'services', 'certifications', 'gallery', 'faqs', 'map'],
  restaurant:      ['hours', 'services', 'gallery', 'social', 'map', 'faqs'],
  barber_salon:    ['hours', 'services', 'gallery', 'team', 'faqs', 'map', 'cta', 'social'],
  beauty:          ['hours', 'services', 'gallery', 'team', 'faqs', 'map', 'cta'],
  healthcare:      ['services', 'team', 'hours', 'certifications', 'faqs', 'map'],
  real_estate:     ['services', 'gallery', 'team', 'faqs', 'social', 'map'],
  retail:          ['hours', 'services', 'gallery', 'social', 'map', 'payment'],
  education:       ['services', 'team', 'certifications', 'faqs', 'social', 'cta'],
  events:          ['services', 'gallery', 'team', 'faqs', 'social', 'cta'],
  creative_agency: ['services', 'gallery', 'team', 'awards', 'faqs', 'social'],
  technology:      ['services', 'team', 'awards', 'faqs', 'social', 'cta'],
  nonprofit:       ['services', 'team', 'gallery', 'faqs', 'social', 'cta'],
  other:           ['services', 'contact', 'hours', 'gallery', 'faqs', 'social'],
};

// Design presets
const LAYOUT_PRESETS = [
  { value: 'classic',   label: 'Classic',   desc: 'Cover → logo → info → sections' },
  { value: 'minimal',   label: 'Minimal',   desc: 'Clean, content-first layout' },
  { value: 'bold',      label: 'Bold',      desc: 'Large cover, prominent CTA' },
  { value: 'card',      label: 'Card',      desc: 'Compact card-style layout' },
] as const;

const COLOUR_PALETTES = [
  { value: 'brand',    label: 'Brand Blue',   primary: '#2563eb', accent: '#1d4ed8' },
  { value: 'forest',   label: 'Forest Green', primary: '#16a34a', accent: '#15803d' },
  { value: 'slate',    label: 'Slate',        primary: '#475569', accent: '#334155' },
  { value: 'rose',     label: 'Rose',         primary: '#e11d48', accent: '#be123c' },
  { value: 'amber',    label: 'Amber',        primary: '#d97706', accent: '#b45309' },
  { value: 'violet',   label: 'Violet',       primary: '#7c3aed', accent: '#6d28d9' },
  { value: 'teal',     label: 'Teal',         primary: '#0d9488', accent: '#0f766e' },
  { value: 'custom',   label: 'Custom',       primary: '',        accent: '' },
] as const;

const BUTTON_STYLES = [
  { value: 'rounded',  label: 'Rounded',  preview: 'rounded-full' },
  { value: 'sharp',    label: 'Sharp',    preview: 'rounded-none' },
  { value: 'soft',     label: 'Soft',     preview: 'rounded-lg' },
  { value: 'outline',  label: 'Outline',  preview: 'rounded-lg border-2' },
] as const;

interface BizProfile {
  id: number;
  biz_slug: string; person_slug: string;
  business_name: string; business_tagline: string; business_description: string; business_category: string;
  business_email: string; business_phone: string; business_website: string; business_address: string;
  opening_hours: string; logo_url: string; cover_url: string; profile_photo: string;
  display_name: string; is_published: number;
  team_directory_public: number;
  business_description_html: string | null;
  services: Service[]; team_members: TeamMember[]; announcements: Announcement[]; social_links: SocialLink[];
}

const EMPTY_SERVICE: Service = { name: '', description: '', price: '', category: '' };
const EMPTY_MEMBER: TeamMember = { name: '', role: '', bio: '', photo: '', email: '', linkedin: '' };
const EMPTY_ANNOUNCEMENT: Announcement = { title: '', body: '', date: '', tag: '' };
const EMPTY_SOCIAL: SocialLink = { platform: '', label: '', url: '' };
const EMPTY_GALLERY: GalleryItem = { url: '', caption: '', type: 'image' };
const EMPTY_AWARD: Award = { title: '', issuer: '', year: '', description: '' };
const EMPTY_FAQ: FaqItem = { question: '', answer: '' };
const EMPTY_CERT: Certification = { name: '', issuer: '', year: '', url: '' };
const EMPTY_TESTIMONIAL: Testimonial = { name: '', role: '', body: '', rating: 5 };
const EMPTY_CTA: CtaButton = { label: '', url: '', style: 'primary' };

const SOCIAL_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube', 'github', 'tiktok', 'other'];
const CATEGORIES = [
  'Retail', 'Restaurant & Food', 'Professional Services', 'Health & Wellness',
  'Technology', 'Creative & Design', 'Education', 'Finance', 'Legal',
  'Construction & Trades', 'Beauty & Personal Care', 'Events', 'Other',
];

// ─── Collapsible section ──────────────────────────────────────────────────

function Section({ title, icon, open, onToggle, children, badge }: {
  title: string; icon: React.ReactNode; open: boolean;
  onToggle: () => void; children: React.ReactNode; badge?: number;
}) {
  return (
    <Card className="bg-card border-border mb-4">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors rounded-xl">
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
          {badge !== undefined && badge > 0 && (
            <Badge className="text-xs bg-primary/10 text-primary border-0 ml-1">{badge}</Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0 pb-5 px-5 border-t border-border/50">{children}</CardContent>}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function BusinessProfileDashboard({ profileId: propProfileId }: { profileId?: string } = {}) {
  const { user } = useAuth();
  const branding = useBranding();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Use server-computed entitlement — never re-derive from plan slug on the client.
  // Seat users with canEditProfile permission can also access this page.
  const seatWorkspace = user?.seatWorkspaces?.[0] ?? null;
  const seatCanEdit = seatWorkspace?.permissions?.canEditProfile ?? false;
  // Business profile requires Professional, Business, Ultimate Business, or Lifetime — NOT Starter
  const hasBusiness = ((user as unknown as Record<string, unknown>)?.hasBusinessProfileAccess as boolean ?? false)
    || (user?.hasBusinessAccess ?? false)
    || (user?.hasProfessionalAccess ?? false)
    || seatCanEdit;

  const [profile, setProfile] = useState<BizProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [noProfile, setNoProfile] = useState(false);

  // Open sections
  const [open, setOpen] = useState<Record<string, boolean>>({
    type: true, design: false, basic: true, contact: false, hours: false,
    services: false, team: false, announcements: false, social: false,
    gallery: false, awards: false, faqs: false, certifications: false, map: false,
    cta: false, payment: false, testimonials: false, featured: false,
    whatsapp: false, menu: false, pdfs: false,
  });
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  // Form state
  const [form, setForm] = useState({
    business_name: '', business_tagline: '', business_description: '', business_description_html: '', business_category: '',
    business_email: '', business_phone: '', business_website: '', business_address: '',
    opening_hours: '', logo_url: '', cover_url: '', profile_photo: '',
    display_name: '', is_published: 1, team_directory_public: 1,
    allow_indexing: 1, seo_title: '', seo_description: '',
    biz_slug: '', legal_company_name: '',
  });
  const [services, setServices] = useState<Service[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [mapEmbed, setMapEmbed] = useState('');
  const [useHtmlDesc, setUseHtmlDesc] = useState(false); // kept for data compat — HTML mode removed from UI
  // New fields
  const [businessType, setBusinessType] = useState<BusinessTypeValue>('other');
  const [layoutPreset, setLayoutPreset] = useState<string>('classic');
  const [colourPalette, setColourPalette] = useState<string>('brand');
  const [customColour, setCustomColour] = useState('#2563eb');
  const [buttonStyle, setButtonStyle] = useState<string>('rounded');
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [ctaButtons, setCtaButtons] = useState<CtaButton[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [featuredOffer, setFeaturedOffer] = useState({ title: '', body: '', badge: '', url: '' });
  const [bookingLink, setBookingLink] = useState('');
  // New feature sections
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [whatsappLabel, setWhatsappLabel] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [menuItems, setMenuItems] = useState<{ id: string; category: string; name: string; description: string; price: string }[]>([]);
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuTitle, setMenuTitle] = useState('');
  const [pdfAttachments, setPdfAttachments] = useState<{ id: string; label: string; url: string; description: string }[]>([]);
  const [pdfEnabled, setPdfEnabled] = useState(false);

  useEffect(() => {
    // Don't run until auth has settled — avoids race where seatWorkspaces is empty on first render
    if (!user) return;

    async function loadProfile() {
      try {
        // If a specific profileId was passed (from All Profiles inline editor), load it directly
        if (propProfileId && propProfileId !== 'new') {
          const full = await fetch(`/api/business/${propProfileId}`, { credentials: 'include' }).then(r => r.json());
          if (full.success) { populateForm(full.data); return; }
          setNoProfile(true); return;
        }

        // First try: own organisation profile
        const d = await fetch('/api/profiles/me', { credentials: 'include' }).then(r => r.json());
        if (d.success) {
          const biz = (d.data as BizProfile[]).find(p => (p as unknown as Record<string, unknown>).profile_type === 'business');
          if (biz) {
            const full = await fetch(`/api/business/${biz.id}`, { credentials: 'include' }).then(r => r.json());
            if (full.success) {
              populateForm(full.data);
              return;
            }
          }
        }

        // Second try: seat workspace profile (if user is a seat member)
        const seatWs = user?.seatWorkspaces?.[0];
        if (seatWs?.profileId) {
          const full = await fetch(`/api/business/${seatWs.profileId}`, { credentials: 'include' }).then(r => r.json());
          if (full.success) {
            populateForm(full.data);
            return;
          }
        }

        // No profile found — show create form for plan owners, or "not found" for seat-only users
        setNoProfile(true);
      } catch {
        setNoProfile(true);
      } finally {
        setLoading(false);
      }
    }

    function populateForm(p: BizProfile) {
      setProfile(p);
      setForm({
        business_name: p.business_name || '',
        business_tagline: p.business_tagline || '',
        business_description: p.business_description || '',
        business_description_html: (p as unknown as Record<string, unknown>).business_description_html as string || '',
        business_category: p.business_category || '',
        business_email: p.business_email || '',
        business_phone: p.business_phone || '',
        business_website: p.business_website || '',
        business_address: p.business_address || '',
        opening_hours: p.opening_hours || '',
        logo_url: p.logo_url || '',
        cover_url: p.cover_url || '',
        profile_photo: p.profile_photo || '',
        display_name: p.display_name || '',
        is_published: p.is_published ?? 1,
        team_directory_public: p.team_directory_public ?? 1,
        allow_indexing: (p as unknown as Record<string, unknown>).allow_indexing as number ?? 1,
        seo_title: (p as unknown as Record<string, unknown>).seo_title as string || '',
        seo_description: (p as unknown as Record<string, unknown>).seo_description as string || '',
        biz_slug: p.biz_slug || '',
        legal_company_name: '',
      });
      setServices(p.services?.length ? p.services : []);
      setTeam(p.team_members?.length ? p.team_members : []);
      setAnnouncements(p.announcements?.length ? p.announcements : []);
      setSocialLinks(p.social_links?.length ? p.social_links : []);
      const ext = p as unknown as Record<string, unknown>;
      setGallery(Array.isArray(ext.gallery) ? (ext.gallery as GalleryItem[]) : []);
      setAwards(Array.isArray(ext.awards) ? (ext.awards as Award[]) : []);
      setFaqs(Array.isArray(ext.faqs) ? (ext.faqs as FaqItem[]) : []);
      setCertifications(Array.isArray(ext.certifications) ? (ext.certifications as Certification[]) : []);
      setMapEmbed(typeof ext.map_embed === 'string' ? ext.map_embed : '');
      setUseHtmlDesc(!!(p as unknown as Record<string, unknown>).business_description_html);
      // New fields
      setTestimonials(Array.isArray(ext.testimonials) ? (ext.testimonials as Testimonial[]) : []);
      setCtaButtons(Array.isArray(ext.cta_buttons) ? (ext.cta_buttons as CtaButton[]) : []);
      setPaymentMethods(Array.isArray(ext.payment_methods) ? (ext.payment_methods as PaymentMethod[]) : []);
      if (ext.featured_offer && typeof ext.featured_offer === 'object') {
        const fo = ext.featured_offer as Record<string, string>;
        setFeaturedOffer({ title: fo.title || '', body: fo.body || '', badge: fo.badge || '', url: fo.url || '' });
      }
      setBookingLink(typeof ext.booking_link === 'string' ? ext.booking_link : '');
      // New feature sections
      setWhatsappUrl(typeof ext.whatsapp_url === 'string' ? ext.whatsapp_url : '');
      setWhatsappLabel(typeof ext.whatsapp_label === 'string' ? ext.whatsapp_label : '');
      setWhatsappEnabled(!!(ext.whatsapp_enabled));
      setMenuItems(Array.isArray(ext.menu_items) ? ext.menu_items as typeof menuItems : (() => { try { return ext.menu_items ? JSON.parse(ext.menu_items as string) : []; } catch { return []; } })());
      setMenuEnabled(!!(ext.menu_enabled));
      setMenuTitle(typeof ext.menu_title === 'string' ? ext.menu_title : '');
      setPdfAttachments(Array.isArray(ext.pdf_attachments) ? ext.pdf_attachments as typeof pdfAttachments : (() => { try { return ext.pdf_attachments ? JSON.parse(ext.pdf_attachments as string) : []; } catch { return []; } })());
      setPdfEnabled(!!(ext.pdf_enabled));
      if (typeof ext.business_type === 'string') setBusinessType(ext.business_type as BusinessTypeValue);
      if (typeof ext.layout_preset === 'string') setLayoutPreset(ext.layout_preset);
      if (typeof ext.colour_palette === 'string') setColourPalette(ext.colour_palette);
      if (typeof ext.custom_colour === 'string') setCustomColour(ext.custom_colour);
      if (typeof ext.button_style === 'string') setButtonStyle(ext.button_style);
    }

    loadProfile();
  }, [user, propProfileId]);

  const handleImageUpload = (field: 'logo_url' | 'cover_url' | 'profile_photo', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setError('Image must be under 3MB');
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, [field]: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/business/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          business_description_html: '',
          business_description: form.business_description,
          services,
          team_members: team,
          announcements,
          social_links: socialLinks,
          gallery,
          awards,
          faqs,
          certifications,
          map_embed: mapEmbed,
          // New fields
          testimonials,
          cta_buttons: ctaButtons,
          payment_methods: paymentMethods,
          featured_offer: featuredOffer,
          booking_link: bookingLink,
          business_type: businessType,
          layout_preset: layoutPreset,
          colour_palette: colourPalette,
          custom_colour: customColour,
          button_style: buttonStyle,
          // New feature sections
          whatsapp_url: whatsappUrl,
          whatsapp_label: whatsappLabel,
          whatsapp_enabled: whatsappEnabled ? 1 : 0,
          menu_items: menuItems,
          menu_enabled: menuEnabled ? 1 : 0,
          menu_title: menuTitle,
          pdf_attachments: pdfAttachments,
          pdf_enabled: pdfEnabled ? 1 : 0,
        }),
      });
      let data: { success?: boolean; error?: string; data?: BizProfile };
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status} ${res.statusText}) — please try again`);
      }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      // Re-sync all form state from the server response so nothing appears lost on save.
      // A successful HTTP status without a profile payload is still an invalid save response.
      if (!data.success || !data.data) {
        throw new Error(data.error || 'The server did not return the saved business profile.');
      }
      const saved_p: BizProfile = data.data;
      setProfile(saved_p);
      setForm({
        business_name: saved_p.business_name || '',
        business_tagline: saved_p.business_tagline || '',
        business_description: saved_p.business_description || '',
        business_description_html: (saved_p as unknown as Record<string, unknown>).business_description_html as string || '',
        business_category: saved_p.business_category || '',
        business_email: saved_p.business_email || '',
        business_phone: saved_p.business_phone || '',
        business_website: saved_p.business_website || '',
        business_address: saved_p.business_address || '',
        opening_hours: saved_p.opening_hours || '',
        logo_url: saved_p.logo_url || '',
        cover_url: saved_p.cover_url || '',
        profile_photo: saved_p.profile_photo || '',
        display_name: saved_p.display_name || '',
        is_published: saved_p.is_published ?? 1,
        team_directory_public: saved_p.team_directory_public ?? 1,
        allow_indexing: (saved_p as unknown as Record<string, unknown>).allow_indexing as number ?? 1,
        seo_title: (saved_p as unknown as Record<string, unknown>).seo_title as string || '',
        seo_description: (saved_p as unknown as Record<string, unknown>).seo_description as string || '',
        biz_slug: saved_p.biz_slug || '',
        legal_company_name: '',
      });
      const ext2 = saved_p as unknown as Record<string, unknown>;
      setServices(saved_p.services?.length ? saved_p.services : []);
      setTeam(saved_p.team_members?.length ? saved_p.team_members : []);
      setAnnouncements(saved_p.announcements?.length ? saved_p.announcements : []);
      setSocialLinks(saved_p.social_links?.length ? saved_p.social_links : []);
      setGallery(Array.isArray(ext2.gallery) ? (ext2.gallery as GalleryItem[]) : []);
      setAwards(Array.isArray(ext2.awards) ? (ext2.awards as Award[]) : []);
      setFaqs(Array.isArray(ext2.faqs) ? (ext2.faqs as FaqItem[]) : []);
      setCertifications(Array.isArray(ext2.certifications) ? (ext2.certifications as Certification[]) : []);
      setMapEmbed(typeof ext2.map_embed === 'string' ? ext2.map_embed : '');
      setTestimonials(Array.isArray(ext2.testimonials) ? (ext2.testimonials as Testimonial[]) : []);
      setCtaButtons(Array.isArray(ext2.cta_buttons) ? (ext2.cta_buttons as CtaButton[]) : []);
      setPaymentMethods(Array.isArray(ext2.payment_methods) ? (ext2.payment_methods as PaymentMethod[]) : []);
      if (ext2.featured_offer && typeof ext2.featured_offer === 'object') {
        const fo = ext2.featured_offer as Record<string, string>;
        setFeaturedOffer({ title: fo.title || '', body: fo.body || '', badge: fo.badge || '', url: fo.url || '' });
      }
      setBookingLink(typeof ext2.booking_link === 'string' ? ext2.booking_link : '');
      setWhatsappUrl(typeof ext2.whatsapp_url === 'string' ? ext2.whatsapp_url : '');
      setWhatsappLabel(typeof ext2.whatsapp_label === 'string' ? ext2.whatsapp_label : '');
      setWhatsappEnabled(!!(ext2.whatsapp_enabled));
      setMenuItems(Array.isArray(ext2.menu_items) ? ext2.menu_items as typeof menuItems : (() => { try { return ext2.menu_items ? JSON.parse(ext2.menu_items as string) : []; } catch { return []; } })());
      setMenuEnabled(!!(ext2.menu_enabled));
      setMenuTitle(typeof ext2.menu_title === 'string' ? ext2.menu_title : '');
      setPdfAttachments(Array.isArray(ext2.pdf_attachments) ? ext2.pdf_attachments as typeof pdfAttachments : (() => { try { return ext2.pdf_attachments ? JSON.parse(ext2.pdf_attachments as string) : []; } catch { return []; } })());
      setPdfEnabled(!!(ext2.pdf_enabled));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / no profile ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-20">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  // Plan gate — show upgrade prompt for free/starter users
  if (!hasBusiness) {
    return (
      <div className="max-w-lg mx-auto pb-20">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Organisation Profile</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            The Organisation Profile is available on the <strong>Professional plan and above</strong>. Upgrade to create a dedicated organisation page with team members, services, opening hours, and more — alongside your personal profile.
          </p>
          <Button className="bg-primary mt-2" onClick={() => window.location.href = '/dashboard/billing'}>
            Upgrade to Professional or above
          </Button>
        </div>
      </div>
    );
  }

  if (noProfile || !profile || propProfileId === 'new') {
    // Seat-only users (no own business plan) must never see the create form —
    // they should be viewing the owner's workspace. If we reach here it means
    // the seat workspace couldn't be loaded (owner downgraded, seat revoked, etc.)
    if (user?.isSeatUser && !user?.hasBusinessAccess && propProfileId !== 'new') {
      return (
        <div className="max-w-lg mx-auto pb-20">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Organisation Workspace</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              The organisation workspace could not be loaded. The organisation owner may have changed your access or downgraded their plan. Please contact them directly.
            </p>
          </div>
        </div>
      );
    }
    // Business plan owners who haven't created a profile yet — show the create form
    return <CreateBusinessProfile onCreated={(profileData) => {
      setNoProfile(false);
      // If the server returned profile data directly (new create or already_exists recovery),
      // load it straight into state without an extra round-trip
      if (profileData) {
        const p = profileData as BizProfile;
        setProfile(p);
        setForm({
          business_name: p.business_name || '', business_tagline: p.business_tagline || '',
          business_description: p.business_description || '', business_description_html: '',
          business_category: p.business_category || '', business_email: p.business_email || '',
          business_phone: p.business_phone || '', business_website: p.business_website || '',
          business_address: p.business_address || '', opening_hours: p.opening_hours || '',
          logo_url: p.logo_url || '', cover_url: p.cover_url || '',
          profile_photo: p.profile_photo || '', display_name: p.display_name || '',
          is_published: p.is_published ?? 1, team_directory_public: p.team_directory_public ?? 1,
          allow_indexing: (p as unknown as Record<string, unknown>).allow_indexing as number ?? 1,
          seo_title: (p as unknown as Record<string, unknown>).seo_title as string || '',
          seo_description: (p as unknown as Record<string, unknown>).seo_description as string || '',
          biz_slug: p.biz_slug || '', legal_company_name: '',
        });
        setServices(p.services?.length ? p.services : []);
        setTeam(p.team_members?.length ? p.team_members : []);
        setAnnouncements(p.announcements?.length ? p.announcements : []);
        setSocialLinks(p.social_links?.length ? p.social_links : []);
        return;
      }
      // Fallback: re-fetch if no data returned
      setLoading(true);
      fetch('/api/profiles/me', { credentials: 'include' }).then(r => r.json()).then(async d => {
        if (!d.success) return;
        const biz = (d.data as BizProfile[]).find(p => (p as unknown as Record<string, unknown>).profile_type === 'business');
        if (!biz) return;
        const full = await fetch(`/api/business/${biz.id}`, { credentials: 'include' }).then(r => r.json());
        if (!full.success) return;
        const p: BizProfile = full.data;
        setProfile(p);
        setForm({
          business_name: p.business_name || '', business_tagline: p.business_tagline || '',
          business_description: p.business_description || '', business_description_html: '',
          business_category: p.business_category || '', business_email: p.business_email || '',
          business_phone: p.business_phone || '', business_website: p.business_website || '',
          business_address: p.business_address || '', opening_hours: p.opening_hours || '',
          logo_url: p.logo_url || '', cover_url: p.cover_url || '',
          profile_photo: p.profile_photo || '', display_name: p.display_name || '',
          is_published: p.is_published ?? 1, team_directory_public: p.team_directory_public ?? 1,
          allow_indexing: (p as unknown as Record<string, unknown>).allow_indexing as number ?? 1,
          seo_title: (p as unknown as Record<string, unknown>).seo_title as string || '',
          seo_description: (p as unknown as Record<string, unknown>).seo_description as string || '',
          biz_slug: p.biz_slug || '', legal_company_name: '',
        });
        setServices(p.services?.length ? p.services : []);
        setTeam(p.team_members?.length ? p.team_members : []);
        setAnnouncements(p.announcements?.length ? p.announcements : []);
        setSocialLinks(p.social_links?.length ? p.social_links : []);
      }).finally(() => setLoading(false));
    }} />;
  }

  // Determine edit permissions — seat users may be read-only
  const isReadOnly = user?.isSeatUser && !user?.hasBusinessAccess && !seatCanEdit;

  const publicUrl = `/profile/${profile.biz_slug}`;
  const businessUrl = `/profile/${profile.biz_slug}`;
  const teamUrl = `/profile/${profile.biz_slug}/team`;

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Organisation Profile — Dashboard</title>
        <meta name="description" content="Edit your organisation profile, team, services and opening hours." />
        <link rel="canonical" href="/dashboard/organisation-profile" />
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organisation Profile</h1>
          <div className="mt-0.5">
            <p className="text-xs text-muted-foreground">
              Organisation page:{' '}
              <span className="text-primary font-mono">{new URL(branding.platform_url).hostname}{businessUrl}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={businessUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-border gap-2">
              <ExternalLink className="w-4 h-4" /> View
            </Button>
          </a>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving} className="bg-primary gap-2">
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : <><Save className="w-4 h-4" /> Save</>}
            </Button>
          )}
        </div>
      </div>

      {/* Read-only banner for seat users without edit permission */}
      {isReadOnly && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-muted border border-border text-sm text-muted-foreground">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>You have view-only access to this organisation workspace. Contact the owner to request edit permissions.</span>
        </div>
      )}

      {/* Seat user context banner */}
      {user?.isSeatUser && !user?.hasBusinessAccess && seatWorkspace && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground">
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span>You are viewing <strong>{seatWorkspace.businessName}</strong> as a <strong>{seatWorkspace.role}</strong> seat member.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* Cover + Logo */}
      <Card className="bg-card border-border mb-4 overflow-hidden">
        <div
          className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 cursor-pointer group"
          onClick={() => coverRef.current?.click()}
        >
          {form.cover_url && <img src={form.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> Change cover
            </span>
          </div>
          {form.cover_url && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, cover_url: '' })); }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
              title="Remove cover image"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('cover_url', e)} />
        </div>
        <CardContent className="pt-0 pb-4 px-5">
          <div className="flex items-end gap-4 -mt-8">
            <div className="relative flex-shrink-0">
              <div
                className="w-16 h-16 rounded-xl border-4 border-background bg-card flex items-center justify-center overflow-hidden cursor-pointer group shadow-lg"
                onClick={() => logoRef.current?.click()}
              >
                {form.logo_url
                  ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  : <Building2 className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                }
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload('logo_url', e)} />
              </div>
              {form.logo_url && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-red-700 transition-colors z-10"
                  title="Remove logo"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="pb-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{form.business_name || 'Your Organisation Name'}</p>
              <p className="text-xs text-muted-foreground">{form.display_name || 'Contact Name'}</p>
            </div>
          </div>
          {/* Image size guidance */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-0.5">Cover / banner image</p>
              <p>Recommended: <span className="font-medium text-foreground">1600 × 600 px</span></p>
              <p>Landscape (wide) format. Max 3 MB. JPG or PNG.</p>
              <p className="mt-0.5 text-[11px]">Images smaller than 800 × 300 px may appear blurry on larger screens.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-0.5">Business logo</p>
              <p>Recommended: <span className="font-medium text-foreground">800 × 800 px</span> square</p>
              <p>PNG with transparent background preferred. Max 3 MB.</p>
              <p className="mt-0.5 text-[11px]">SVG files are not supported — export as PNG at 800 × 800 px for best quality.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="py-4 px-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Published</p>
            <p className="text-xs text-muted-foreground">Make your organisation page visible to the public</p>
          </div>
          <Switch checked={!!form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v ? 1 : 0 }))} />
        </CardContent>
      </Card>

      {/* Team directory lock */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              {form.team_directory_public
                ? <Unlock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                : <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className="text-sm font-medium text-foreground">Team Directory</p>
                <p className="text-xs text-muted-foreground">
                  {form.team_directory_public
                    ? <>Public — visible at <span className="font-mono text-primary">{new URL(branding.platform_url).hostname}{teamUrl}</span></>
                    : 'Private — only you can see the team directory'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={!!form.team_directory_public}
              onCheckedChange={async v => {
                setForm(f => ({ ...f, team_directory_public: v ? 1 : 0 }));
                try {
                  await fetch(`/api/business/${profile.id}/team-directory`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ team_directory_public: v }),
                  });
                } catch { /* ignore — will be saved on next full save */ }
              }}
            />
          </div>
          {form.team_directory_public ? (
            <a href={teamUrl} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> View team directory
            </a>
          ) : null}
        </CardContent>
      </Card>

      {/* Export */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="py-4 px-5">
          <p className="text-sm font-medium text-foreground mb-1">Export Organisation Card</p>
          <p className="text-xs text-muted-foreground mb-3">Download or print your organisation profile as a card</p>
          <ProfileExport
            profile={form}
            profileUrl={`${new URL(branding.platform_url).origin}${publicUrl}`}
            variant="business"
          />
        </CardContent>
      </Card>

      {/* SEO & Search Engine Visibility */}
      <Card className="bg-card border-border mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Search Engine Visibility</CardTitle>
          </div>
          <CardDescription>Control how Google and other search engines see your organisation page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Allow search engines to index this page</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.allow_indexing
                  ? <span className="text-green-400">Visible to Google — included in sitemap.xml</span>
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
                  placeholder={form.business_name || 'Your Organisation Name'}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.seo_title.length}/60 characters. Leave blank to use your organisation name.</p>
              </div>
              <div>
                <Label>SEO Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={form.seo_description}
                  onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                  className="mt-1.5 bg-background border-border resize-none"
                  rows={3}
                  placeholder={form.business_description?.slice(0, 160) || 'Describe your organisation for search engines...'}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.seo_description.length}/160 characters. Leave blank to use your organisation description.</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Google Search Console tip</p>
                <p>Submit your sitemap at <span className="font-mono text-primary">{branding.platform_url}/sitemap.xml</span> to help Google discover your organisation page faster.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Organisation Type Selector ─────────────────────────────────────── */}
      <Section title="Organisation Type" icon={<Building2 className="w-4 h-4" />} open={open.type} onToggle={() => toggle('type')}>
        <div className="pt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Choose the type that best describes your organisation. This tailors the suggested sections and wording on your profile.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUSINESS_TYPES.map(bt => (
              <button
                key={bt.value}
                type="button"
                onClick={() => setBusinessType(bt.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  businessType === bt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 bg-muted/10'
                }`}
              >
                <span className="text-xl leading-none mt-0.5 flex-shrink-0">{bt.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-tight ${businessType === bt.value ? 'text-primary' : 'text-foreground'}`}>
                    {bt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{bt.hint}</p>
                </div>
              </button>
            ))}
          </div>
          {/* Suggested sections hint */}
          {businessType && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Suggested sections for {BUSINESS_TYPES.find(b => b.value === businessType)?.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_SUGGESTED_SECTIONS[businessType].map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium capitalize">
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Design Options ─────────────────────────────────────────────── */}
      <Section title="Design & Appearance" icon={<Palette className="w-4 h-4" />} open={open.design} onToggle={() => toggle('design')}>
        <div className="pt-4 space-y-5">

          {/* Layout preset */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Layout preset</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LAYOUT_PRESETS.map(lp => (
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
              {COLOUR_PALETTES.map(cp => (
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
                <Label className="text-xs">Custom primary colour</Label>
                <input
                  type="color"
                  value={customColour}
                  onChange={e => setCustomColour(e.target.value)}
                  className="w-10 h-8 rounded border border-border cursor-pointer bg-background"
                />
                <span className="text-xs font-mono text-muted-foreground">{customColour}</span>
              </div>
            )}
          </div>

          {/* Button style */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Button style</p>
            <div className="flex flex-wrap gap-2">
              {BUTTON_STYLES.map(bs => (
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

        </div>
      </Section>

      {/* Basic Info */}
      <Section title="Business Information" icon={<Building2 className="w-4 h-4" />} open={open.basic} onToggle={() => toggle('basic')}>
        <div className="space-y-4 pt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Organisation Name <span className="text-destructive">*</span></Label>
              <Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                className="mt-1.5 bg-background border-border" placeholder="Smith Design Studio" />
            </div>
            <div>
              <Label>Contact / Representative Name</Label>
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="mt-1.5 bg-background border-border" placeholder="Jane Smith" />
            </div>
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={form.business_tagline} onChange={e => setForm(f => ({ ...f, business_tagline: e.target.value }))}
              className="mt-1.5 bg-background border-border" placeholder="Short catchy tagline" />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={form.business_category}
              onChange={e => setForm(f => ({ ...f, business_category: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select a category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.business_description}
              onChange={e => setForm(f => ({ ...f, business_description: e.target.value, business_description_html: '' }))}
              className="mt-1.5 bg-background border-border resize-none" rows={4}
              placeholder="Tell visitors what your organisation does…" />
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact Details" icon={<Phone className="w-4 h-4" />} open={open.contact} onToggle={() => toggle('contact')}>
        <div className="space-y-3 pt-4">
          {[
            { key: 'business_phone', label: 'Phone', icon: <Phone className="w-3.5 h-3.5" />, placeholder: '+44 7700 900123' },
            { key: 'business_email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" />, placeholder: 'hello@yourbusiness.com' },
            { key: 'business_website', label: 'Website', icon: <Globe className="w-3.5 h-3.5" />, placeholder: 'https://yourbusiness.com' },
            { key: 'business_address', label: 'Address', icon: <MapPin className="w-3.5 h-3.5" />, placeholder: '123 High Street, London' },
          ].map(f => (
            <div key={f.key}>
              <Label className="flex items-center gap-1.5">{f.icon}{f.label}</Label>
              <Input value={form[f.key as keyof typeof form] as string}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1.5 bg-background border-border" placeholder={f.placeholder} />
            </div>
          ))}
        </div>
      </Section>

      {/* Opening Hours */}
      <Section title="Opening Hours" icon={<Clock className="w-4 h-4" />} open={open.hours} onToggle={() => toggle('hours')}>
        <div className="pt-4">
          <Label>Opening Hours</Label>
          <Textarea value={form.opening_hours} onChange={e => setForm(f => ({ ...f, opening_hours: e.target.value }))}
            className="mt-1.5 bg-background border-border resize-none font-mono text-sm" rows={7}
            placeholder={`Monday:    9:00am – 5:00pm\nTuesday:   9:00am – 5:00pm\nWednesday: 9:00am – 5:00pm\nThursday:  9:00am – 5:00pm\nFriday:    9:00am – 5:00pm\nSaturday:  Closed\nSunday:    Closed`} />
          <p className="text-xs text-muted-foreground mt-1.5">Enter each day on a new line</p>
        </div>
      </Section>

      {/* Services */}
      <Section title="Services & Products" icon={<Briefcase className="w-4 h-4" />} open={open.services} onToggle={() => toggle('services')} badge={services.length}>
        <div className="space-y-3 pt-4">
          {services.map((s, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service {i + 1}</span>
                <button onClick={() => setServices(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={s.name} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Web Design" />
                </div>
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input value={s.price} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="From £500" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={s.category} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                  className="mt-1 bg-background border-border text-sm" placeholder="Design" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={s.description} onChange={e => setServices(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  className="mt-1 bg-background border-border resize-none text-sm" rows={2} placeholder="Brief description…" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setServices(prev => [...prev, { ...EMPTY_SERVICE }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Service / Product
          </Button>
        </div>
      </Section>

      {/* Team */}
      <Section title="Team Members" icon={<Users className="w-4 h-4" />} open={open.team} onToggle={() => toggle('team')} badge={team.length}>
        <div className="space-y-3 pt-4">
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Team member photo: </span>
            Recommended <span className="font-medium text-foreground">800 × 800 px</span> square headshot. Enter a public image URL (e.g. from your website or LinkedIn). JPG or PNG preferred.
          </div>
          {team.map((m, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member {i + 1}</span>
                <button onClick={() => setTeam(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Full Name</Label>
                  <Input value={m.name} onChange={e => setTeam(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Jane Smith" />
                </div>
                <div>
                  <Label className="text-xs">Role / Job Title</Label>
                  <Input value={m.role} onChange={e => setTeam(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Lead Designer" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={m.email} onChange={e => setTeam(prev => prev.map((x, j) => j === i ? { ...x, email: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="jane@company.com" />
                </div>
                <div>
                  <Label className="text-xs">LinkedIn URL</Label>
                  <Input value={m.linkedin} onChange={e => setTeam(prev => prev.map((x, j) => j === i ? { ...x, linkedin: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="https://linkedin.com/in/…" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bio</Label>
                <Textarea value={m.bio} onChange={e => setTeam(prev => prev.map((x, j) => j === i ? { ...x, bio: e.target.value } : x))}
                  className="mt-1 bg-background border-border resize-none text-sm" rows={2} placeholder="Short bio…" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setTeam(prev => [...prev, { ...EMPTY_MEMBER }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Team Member
          </Button>
        </div>
      </Section>

      {/* Announcements section removed — merged into Featured Offer / Announcement above */}

      {/* Social Links */}
      <Section title="Social Media Links" icon={<Globe className="w-4 h-4" />} open={open.social} onToggle={() => toggle('social')} badge={socialLinks.length}>
        <div className="space-y-3 pt-4">
          {socialLinks.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s.platform}
                onChange={e => setSocialLinks(prev => prev.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))}
                className="rounded-lg border border-border bg-background text-foreground text-sm px-2 py-2 outline-none focus:ring-2 focus:ring-primary/30 w-32 flex-shrink-0"
              >
                <option value="">Platform</option>
                {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <Input value={s.url} onChange={e => setSocialLinks(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                className="bg-background border-border text-sm flex-1" placeholder="https://…" />
              <button onClick={() => setSocialLinks(prev => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSocialLinks(prev => [...prev, { ...EMPTY_SOCIAL }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Social Link
          </Button>
        </div>
      </Section>

      {/* Gallery */}
      <Section title="Photo & Video Gallery" icon={<GalleryHorizontal className="w-4 h-4" />} open={open.gallery} onToggle={() => toggle('gallery')} badge={gallery.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Add image or video URLs to showcase your work, premises, products or events on your public profile.</p>
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Recommended image size: </span>
            <span className="font-medium text-foreground">1200 × 800 px</span> (landscape). JPG or PNG. For best quality, use images at least 800 × 600 px. Images smaller than this may appear blurry on larger screens.
          </div>
          {gallery.map((g, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {i + 1}</span>
                <button onClick={() => setGallery(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <select
                    value={g.type}
                    onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value as 'image' | 'video' } : x))}
                    className="mt-1 w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Caption (optional)</Label>
                  <Input value={g.caption} onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Our studio space" />
                </div>
              </div>
              <div>
                <Label className="text-xs">URL</Label>
                <Input value={g.url} onChange={e => setGallery(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  className="mt-1 bg-background border-border text-sm font-mono" placeholder="https://…" />
                {g.url && g.type === 'image' && (
                  <img src={g.url} alt={g.caption || ''} className="mt-2 h-24 w-full object-cover rounded-lg border border-border" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setGallery(prev => [...prev, { ...EMPTY_GALLERY }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Gallery Item
          </Button>
        </div>
      </Section>

      {/* Awards & Recognition */}
      <Section title="Awards & Recognition" icon={<Award className="w-4 h-4" />} open={open.awards} onToggle={() => toggle('awards')} badge={awards.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Showcase awards, prizes, and recognition your organisation has received.</p>
          {awards.map((a, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Award {i + 1}</span>
                <button onClick={() => setAwards(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Award Title</Label>
                  <Input value={a.title} onChange={e => setAwards(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Best Local Business 2024" />
                </div>
                <div>
                  <Label className="text-xs">Issuing Organisation</Label>
                  <Input value={a.issuer} onChange={e => setAwards(prev => prev.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Chamber of Commerce" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Year</Label>
                  <Input value={a.year} onChange={e => setAwards(prev => prev.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="2024" />
                </div>
                <div>
                  <Label className="text-xs">Description (optional)</Label>
                  <Input value={a.description} onChange={e => setAwards(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Recognised for outstanding service" />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setAwards(prev => [...prev, { ...EMPTY_AWARD }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Award
          </Button>
        </div>
      </Section>

      {/* Certifications */}
      <Section title="Certifications & Accreditations" icon={<Star className="w-4 h-4" />} open={open.certifications} onToggle={() => toggle('certifications')} badge={certifications.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">List professional certifications, trade body memberships, or industry accreditations.</p>
          {certifications.map((c, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Certification {i + 1}</span>
                <button onClick={() => setCertifications(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Certification Name</Label>
                  <Input value={c.name} onChange={e => setCertifications(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="ISO 9001 Certified" />
                </div>
                <div>
                  <Label className="text-xs">Issuing Body</Label>
                  <Input value={c.issuer} onChange={e => setCertifications(prev => prev.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="BSI Group" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Year Obtained</Label>
                  <Input value={c.year} onChange={e => setCertifications(prev => prev.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="2023" />
                </div>
                <div>
                  <Label className="text-xs">Verification URL (optional)</Label>
                  <Input value={c.url} onChange={e => setCertifications(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm font-mono" placeholder="https://…" />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCertifications(prev => [...prev, { ...EMPTY_CERT }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Certification
          </Button>
        </div>
      </Section>

      {/* FAQs */}
      <Section title="FAQs" icon={<CircleHelp className="w-4 h-4" />} open={open.faqs} onToggle={() => toggle('faqs')} badge={faqs.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Add frequently asked questions to help visitors understand your business before they get in touch.</p>
          {faqs.map((f, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">FAQ {i + 1}</span>
                <button onClick={() => setFaqs(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <Label className="text-xs">Question</Label>
                <Input value={f.question} onChange={e => setFaqs(prev => prev.map((x, j) => j === i ? { ...x, question: e.target.value } : x))}
                  className="mt-1 bg-background border-border text-sm" placeholder="What are your payment terms?" />
              </div>
              <div>
                <Label className="text-xs">Answer</Label>
                <Textarea value={f.answer} onChange={e => setFaqs(prev => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))}
                  className="mt-1 bg-background border-border resize-none text-sm" rows={3} placeholder="We accept payment by…" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setFaqs(prev => [...prev, { ...EMPTY_FAQ }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add FAQ
          </Button>
        </div>
      </Section>

      {/* Map Embed */}
      <Section title="Location Map" icon={<MapPin className="w-4 h-4" />} open={open.map} onToggle={() => toggle('map')}>
        <div className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">
            Paste a Google Maps embed URL to show your location on your organisation profile. In Google Maps, click Share → Embed a map → copy the <span className="font-mono">src="…"</span> URL only.
          </p>
          <div>
            <Label>Google Maps Embed URL</Label>
            <Input
              value={mapEmbed}
              onChange={e => setMapEmbed(e.target.value)}
              className="mt-1.5 bg-background border-border font-mono text-xs"
              placeholder="https://www.google.com/maps/embed?pb=…"
            />
          </div>
          {mapEmbed && mapEmbed.startsWith('https://www.google.com/maps/embed') && (
            <div className="rounded-xl overflow-hidden border border-border">
              <iframe
                src={mapEmbed}
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Business location map"
              />
            </div>
          )}
          {mapEmbed && !mapEmbed.startsWith('https://www.google.com/maps/embed') && (
            <p className="text-xs text-orange-400">The URL must start with <span className="font-mono">https://www.google.com/maps/embed</span></p>
          )}
        </div>
      </Section>

      {/* Testimonials */}
      <Section title="Testimonials & Reviews" icon={<MessageSquareQuote className="w-4 h-4" />} open={open.testimonials} onToggle={() => toggle('testimonials')} badge={testimonials.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Add customer testimonials and reviews to build trust with visitors.</p>
          {testimonials.map((t, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Testimonial {i + 1}</span>
                <button onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={t.name} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="Jane Smith" />
                </div>
                <div>
                  <Label className="text-xs">Role / Company (optional)</Label>
                  <Input value={t.role} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" placeholder="CEO, Acme Ltd" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Review</Label>
                <Textarea value={t.body} onChange={e => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                  className="mt-1 bg-background border-border resize-none text-sm" rows={3} placeholder="What did they say about your business?" />
              </div>
              <div>
                <Label className="text-xs">Star Rating (1–5)</Label>
                <div className="flex items-center gap-2 mt-1">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setTestimonials(prev => prev.map((x, j) => j === i ? { ...x, rating: star } : x))}
                      className={`text-xl transition-colors ${star <= t.rating ? 'text-amber-400' : 'text-muted-foreground/30'}`}>
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">{t.rating}/5</span>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setTestimonials(prev => [...prev, { ...EMPTY_TESTIMONIAL }])}
            className="w-full border-dashed border-border gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Testimonial
          </Button>
        </div>
      </Section>

      {/* Featured Offer / Announcement Banner */}
      <Section title="Featured Offer / Announcement" icon={<Sparkles className="w-4 h-4" />} open={open.announcements} onToggle={() => toggle('announcements')} badge={announcements.length + (featuredOffer.title ? 1 : 0)}>
        <div className="space-y-5 pt-4">
          {/* Featured offer banner */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Pinned offer / announcement banner</p>
            <p className="text-xs text-muted-foreground">A highlighted banner shown at the top of your profile — great for promotions, seasonal offers, or important news.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={featuredOffer.title} onChange={e => setFeaturedOffer(f => ({ ...f, title: e.target.value }))}
                  className="mt-1 bg-background border-border text-sm" placeholder="Summer Sale — 20% off!" />
              </div>
              <div>
                <Label className="text-xs">Badge label (optional)</Label>
                <Input value={featuredOffer.badge} onChange={e => setFeaturedOffer(f => ({ ...f, badge: e.target.value }))}
                  className="mt-1 bg-background border-border text-sm" placeholder="Limited time · New · Hot" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Details</Label>
              <Textarea value={featuredOffer.body} onChange={e => setFeaturedOffer(f => ({ ...f, body: e.target.value }))}
                className="mt-1 bg-background border-border resize-none text-sm" rows={2} placeholder="More details about the offer…" />
            </div>
            <div>
              <Label className="text-xs">Link URL (optional)</Label>
              <Input value={featuredOffer.url} onChange={e => setFeaturedOffer(f => ({ ...f, url: e.target.value }))}
                className="mt-1 bg-background border-border text-sm font-mono" placeholder="https://…" />
            </div>
          </div>

          {/* Updates / announcements list */}
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Updates & news posts</p>
            {announcements.map((a, i) => (
              <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update {i + 1}</span>
                  <button onClick={() => setAnnouncements(prev => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={a.title} onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      className="mt-1 bg-background border-border text-sm" placeholder="New service launched!" />
                  </div>
                  <div>
                    <Label className="text-xs">Tag (optional)</Label>
                    <Input value={a.tag} onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, tag: e.target.value } : x))}
                      className="mt-1 bg-background border-border text-sm" placeholder="New · Offer · Event" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Date (optional)</Label>
                  <Input type="date" value={a.date} onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                    className="mt-1 bg-background border-border text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea value={a.body} onChange={e => setAnnouncements(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                    className="mt-1 bg-background border-border resize-none text-sm" rows={2} placeholder="Details…" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setAnnouncements(prev => [...prev, { ...EMPTY_ANNOUNCEMENT }])}
              className="w-full border-dashed border-border gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Update
            </Button>
          </div>
        </div>
      </Section>

      {/* Booking & CTA */}
      <Section title="Booking & Call-to-Action Buttons" icon={<MousePointerClick className="w-4 h-4" />} open={open.cta} onToggle={() => toggle('cta')} badge={ctaButtons.length + (bookingLink ? 1 : 0)}>
        <div className="space-y-5 pt-4">
          <div>
            <Label className="flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" />Booking / appointment link</Label>
            <Input value={bookingLink} onChange={e => setBookingLink(e.target.value)}
              className="mt-1.5 bg-background border-border font-mono text-sm" placeholder="https://calendly.com/… or https://booksy.com/…" />
            <p className="text-xs text-muted-foreground mt-1">Shown as a prominent "Book Now" button on your profile.</p>
          </div>
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Custom call-to-action buttons</p>
            <p className="text-xs text-muted-foreground">Add up to 5 custom buttons — links to your website, shop, portfolio, or any other destination.</p>
            {ctaButtons.map((c, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <Input value={c.label} onChange={e => setCtaButtons(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  className="bg-background border-border text-sm w-32 flex-shrink-0" placeholder="Button label" />
                <Input value={c.url} onChange={e => setCtaButtons(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  className="bg-background border-border text-sm flex-1 min-w-0 font-mono" placeholder="https://…" />
                <select value={c.style} onChange={e => setCtaButtons(prev => prev.map((x, j) => j === i ? { ...x, style: e.target.value as CtaButton['style'] } : x))}
                  className="rounded-lg border border-border bg-background text-foreground text-sm px-2 py-2 outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                </select>
                <button onClick={() => setCtaButtons(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {ctaButtons.length < 5 && (
              <Button variant="outline" size="sm" onClick={() => setCtaButtons(prev => [...prev, { ...EMPTY_CTA }])}
                className="w-full border-dashed border-border gap-2">
                <Plus className="w-3.5 h-3.5" /> Add CTA Button
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* Payment Methods */}
      <Section title="Payment Methods" icon={<CreditCardIcon className="w-4 h-4" />} open={open.payment} onToggle={() => toggle('payment')} badge={paymentMethods.length}>
        <div className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">Let customers know which payment methods you accept.</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {['Cash', 'Card', 'Bank Transfer', 'PayPal', 'Stripe', 'Klarna', 'Cheque', 'Crypto', 'Invoice'].map(pm => (
              <button
                key={pm}
                type="button"
                onClick={() => {
                  const exists = paymentMethods.some(p => p.name === pm);
                  if (exists) setPaymentMethods(prev => prev.filter(p => p.name !== pm));
                  else setPaymentMethods(prev => [...prev, { name: pm }]);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  paymentMethods.some(p => p.name === pm)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Other payment method…"
              className="bg-background border-border text-sm flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val && !paymentMethods.some(p => p.name === val)) {
                    setPaymentMethods(prev => [...prev, { name: val }]);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
            <span className="text-xs text-muted-foreground">Press Enter to add</span>
          </div>
          {paymentMethods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {paymentMethods.map((pm, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {pm.name}
                  <button onClick={() => setPaymentMethods(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive transition-colors ml-0.5">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* WhatsApp Button */}
      <Section title="WhatsApp Button" icon={<MessageSquareQuote className="w-4 h-4" />} open={open.whatsapp ?? false} onToggle={() => toggle('whatsapp')} badge={whatsappEnabled ? 1 : 0}>
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show WhatsApp button on profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">A green WhatsApp button appears on your public organisation profile.</p>
            </div>
            <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp link</Label>
            <Input value={whatsappUrl} onChange={e => setWhatsappUrl(e.target.value)}
              className="bg-background border-border font-mono text-sm" placeholder="https://wa.me/447700000000" />
            <p className="text-xs text-muted-foreground">Format: https://wa.me/[country code][number] — e.g. https://wa.me/447700123456</p>
          </div>
          <div className="space-y-1.5">
            <Label>Button label <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input value={whatsappLabel} onChange={e => setWhatsappLabel(e.target.value)}
              className="bg-background border-border text-sm" placeholder="Message us on WhatsApp" maxLength={60} />
          </div>
        </div>
      </Section>

      {/* Menu / Price List */}
      <Section title="Menu / Price List" icon={<Sparkles className="w-4 h-4" />} open={open.menu ?? false} onToggle={() => toggle('menu')} badge={menuItems.filter(i => i.name).length}>
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show menu on profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">Display your menu, price list, or service catalogue on your business profile.</p>
            </div>
            <Switch checked={menuEnabled} onCheckedChange={setMenuEnabled} />
          </div>
          <div className="space-y-1.5">
            <Label>Section title</Label>
            <Input value={menuTitle} onChange={e => setMenuTitle(e.target.value)}
              className="bg-background border-border text-sm" placeholder="e.g. Our Menu, Price List, Services" maxLength={60} />
          </div>
          <div className="space-y-3">
            {menuItems.map((item, idx) => (
              <div key={item.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
                  <button type="button" onClick={() => setMenuItems(prev => prev.filter(i => i.id !== item.id))} className="text-destructive hover:opacity-70 text-xs">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={item.name} onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                    className="bg-background border-border text-sm" placeholder="Item name *" maxLength={80} />
                  <Input value={item.price} onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, price: e.target.value } : i))}
                    className="bg-background border-border text-sm" placeholder="Price (e.g. £25)" maxLength={30} />
                </div>
                <Input value={item.category} onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, category: e.target.value } : i))}
                  className="bg-background border-border text-sm" placeholder="Category (optional — groups items)" maxLength={60} />
                <Input value={item.description} onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                  className="bg-background border-border text-sm" placeholder="Description (optional)" maxLength={200} />
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setMenuItems(prev => [...prev, { id: Date.now().toString(), category: '', name: '', description: '', price: '' }])}
              className="w-full border-dashed border-border gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add item
            </Button>
          </div>
        </div>
      </Section>

      {/* PDF Attachments */}
      <Section title="PDF Attachments" icon={<Globe className="w-4 h-4" />} open={open.pdfs ?? false} onToggle={() => toggle('pdfs')} badge={pdfAttachments.filter(i => i.url && i.label).length}>
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show PDF attachments on profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">Display downloadable PDF links on your business profile.</p>
            </div>
            <Switch checked={pdfEnabled} onCheckedChange={setPdfEnabled} />
          </div>
          <div className="space-y-3">
            {pdfAttachments.map((item, idx) => (
              <div key={item.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Document {idx + 1}</span>
                  <button type="button" onClick={() => setPdfAttachments(prev => prev.filter(i => i.id !== item.id))} className="text-destructive hover:opacity-70 text-xs">Remove</button>
                </div>
                <Input value={item.label} onChange={e => setPdfAttachments(prev => prev.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))}
                  className="bg-background border-border text-sm" placeholder="Label e.g. Company Brochure *" maxLength={80} />
                <Input value={item.url} onChange={e => setPdfAttachments(prev => prev.map(i => i.id === item.id ? { ...i, url: e.target.value } : i))}
                  className="bg-background border-border text-sm font-mono" placeholder="https://drive.google.com/file/d/…" />
                <Input value={item.description} onChange={e => setPdfAttachments(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                  className="bg-background border-border text-sm" placeholder="Description (optional)" maxLength={120} />
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setPdfAttachments(prev => [...prev, { id: Date.now().toString(), label: '', url: '', description: '' }])}
              className="w-full border-dashed border-border gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add PDF
            </Button>
          </div>
        </div>
      </Section>

      {/* Save footer */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-primary gap-2">
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : <><Save className="w-4 h-4" /> Save Business Profile</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Create Business Profile form ────────────────────────────────────────

// ─── Personalisation wizard ───────────────────────────────────────────────

const WIZARD_STEPS = ['type', 'purpose', 'name'] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const ORG_PURPOSES = [
  { value: 'showcase',    label: 'Showcase my work / portfolio',        icon: '🎨' },
  { value: 'leads',       label: 'Generate enquiries and leads',         icon: '📩' },
  { value: 'directory',   label: 'Team / staff directory',               icon: '👥' },
  { value: 'services',    label: 'List services and pricing',            icon: '📋' },
  { value: 'brand',       label: 'Build brand awareness',                icon: '📣' },
  { value: 'community',   label: 'Community or non-profit presence',     icon: '🤝' },
  { value: 'other',       label: 'Something else',                       icon: '⚡' },
] as const;

function CreateBusinessProfile({ onCreated }: { onCreated: (profileData?: unknown) => void }) {
  const [step, setStep] = useState<WizardStep>('type');
  const [selectedType, setSelectedType] = useState<BusinessTypeValue | ''>('');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [form, setForm] = useState({ business_name: '', biz_slug: '', legal_company_name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  const handleChange = (field: string, value: string) => {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'business_name') next.biz_slug = slugify(value);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.business_name.trim()) return setError('Organisation name is required.');
    if (!form.biz_slug) return setError('URL slug is required.');
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile_type: 'business',
          business_name: form.business_name.trim(),
          biz_slug: form.biz_slug,
          legal_company_name: form.legal_company_name || undefined,
          business_type: selectedType || 'other',
          org_purpose: selectedPurpose || 'other',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create');
      onCreated(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organisation profile');
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = WIZARD_STEPS.indexOf(step);

  return (
    <div className="max-w-lg mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 py-8 text-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Create Your Organisation / Business Profile</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Answer a few quick questions so we can personalise your profile for you. Your personal profile stays separate.
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-6 px-1">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
              i < stepIndex ? 'bg-primary text-primary-foreground' :
              i === stepIndex ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full transition-all ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-5">

          {/* ── Step 1: Organisation type ── */}
          {step === 'type' && (
            <>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">What type of organisation or business is this?</h3>
                <p className="text-xs text-muted-foreground mb-4">We will suggest the most relevant sections for your profile.</p>
                <div className="grid grid-cols-1 gap-2">
                  {BUSINESS_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setSelectedType(t.value)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        selectedType === t.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">{t.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.hint}</p>
                      </div>
                      {selectedType === t.value && (
                        <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => { if (selectedType) setStep('purpose'); }}
                disabled={!selectedType}
                className="w-full bg-primary h-11"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {/* ── Step 2: Purpose ── */}
          {step === 'purpose' && (
            <>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">What is the main goal of this profile?</h3>
                <p className="text-xs text-muted-foreground mb-4">Choose the one that fits best — you can always change things later.</p>
                <div className="grid grid-cols-1 gap-2">
                  {ORG_PURPOSES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedPurpose(p.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selectedPurpose === p.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{p.icon}</span>
                      <p className="text-sm font-medium text-foreground flex-1">{p.label}</p>
                      {selectedPurpose === p.value && (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('type')} className="flex-1 h-11 border-border">
                  Back
                </Button>
                <Button
                  onClick={() => { if (selectedPurpose) setStep('name'); }}
                  disabled={!selectedPurpose}
                  className="flex-1 bg-primary h-11"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Name & URL ── */}
          {step === 'name' && (
            <>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">Name your organisation / business</h3>
                <p className="text-xs text-muted-foreground mb-4">This is the name that will appear publicly on your profile page.</p>
              </div>

              {/* Summary of choices */}
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedType && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1">
                    {BUSINESS_TYPES.find(t => t.value === selectedType)?.icon}{' '}
                    {BUSINESS_TYPES.find(t => t.value === selectedType)?.label}
                  </span>
                )}
                {selectedPurpose && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted text-muted-foreground border border-border rounded-full px-2.5 py-1">
                    {ORG_PURPOSES.find(p => p.value === selectedPurpose)?.icon}{' '}
                    {ORG_PURPOSES.find(p => p.value === selectedPurpose)?.label}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Organisation / Trading Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.business_name}
                  onChange={e => handleChange('business_name', e.target.value)}
                  placeholder="e.g. JA Group Services"
                  className="bg-background border-border"
                  autoFocus
                />
                {form.biz_slug && (
                  <p className="text-xs text-muted-foreground">
                    Profile URL: <span className="text-primary font-mono">/profile/{form.biz_slug}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Legal Company Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.legal_company_name}
                  onChange={e => handleChange('legal_company_name', e.target.value)}
                  placeholder="e.g. JA Group Services Ltd"
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">The registered legal name if different from your trading name.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Profile URL Slug</Label>
                <Input
                  value={form.biz_slug}
                  onChange={e => handleChange('biz_slug', slugify(e.target.value))}
                  placeholder="e.g. ja-group-services"
                  className="bg-background border-border font-mono"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('purpose')} className="flex-1 h-11 border-border">
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={saving} className="flex-1 bg-primary h-11 gap-2">
                  {saving ? <Building2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {saving ? 'Creating…' : 'Create Profile'}
                </Button>
              </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

