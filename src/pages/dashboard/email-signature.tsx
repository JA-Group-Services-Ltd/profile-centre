import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileSignature, Copy, Check, Download, Trash2, Save, Loader2,
  Eye, ChevronDown, Palette, AlertCircle,
  User, Link2, MousePointerClick, Upload, X, ImageIcon,
} from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { SIGNATURE_TEMPLATES, TEMPLATE_CATEGORIES, type SignatureTemplate } from '@/lib/signature-templates';
import { renderSignatureHtml, renderSignaturePlainText, type SignatureData } from '@/lib/signature-renderer';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SocialLink { platform: string; url: string; label?: string }

interface SigForm {
  template_id: string;
  name: string;
  job_title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  profile_url: string;
  photo_url: string;
  logo_url: string;
  social_links: SocialLink[];
  show_name: boolean;
  show_job_title: boolean;
  show_company: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_website: boolean;
  show_qr: boolean;
  show_social: boolean;
  show_photo: boolean;
  show_logo: boolean;
  accent_color: string;
  signature_by: string;
}

const DEFAULT_FORM: SigForm = {
  template_id: 'corp-h-light',
  name: '', job_title: '', company: '', phone: '', email: '',
  website: '', profile_url: '', photo_url: '', logo_url: '',
  social_links: [],
  show_name: true, show_job_title: true, show_company: true,
  show_phone: true, show_email: true, show_website: true,
  show_qr: true, show_social: true, show_photo: true, show_logo: false,
  accent_color: '#3B82F6',
  signature_by: '',
};

const SOCIAL_PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',    placeholder: 'https://linkedin.com/in/yourname' },
  { id: 'facebook',  label: 'Facebook',    placeholder: 'https://facebook.com/yourpage' },
  { id: 'instagram', label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle' },
  { id: 'twitter',   label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { id: 'tiktok',    label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle' },
  { id: 'youtube',   label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel' },
  { id: 'whatsapp',  label: 'WhatsApp',    placeholder: 'https://wa.me/447700000000' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formToSignatureData(form: SigForm, qrUrl: string | null): SignatureData {
  return {
    ...form,
    show_name: form.show_name ? 1 : 0,
    show_job_title: form.show_job_title ? 1 : 0,
    show_company: form.show_company ? 1 : 0,
    show_phone: form.show_phone ? 1 : 0,
    show_email: form.show_email ? 1 : 0,
    show_website: form.show_website ? 1 : 0,
    show_qr: form.show_qr ? 1 : 0,
    show_social: form.show_social ? 1 : 0,
    show_photo: form.show_photo ? 1 : 0,
    show_logo: form.show_logo ? 1 : 0,
    qr_url: qrUrl,
  };
}

function apiToForm(data: Record<string, unknown>): SigForm {
  return {
    template_id: String(data.template_id ?? 'corp-h-light'),
    name: String(data.name ?? ''),
    job_title: String(data.job_title ?? ''),
    company: String(data.company ?? ''),
    phone: String(data.phone ?? ''),
    email: String(data.email ?? ''),
    website: String(data.website ?? ''),
    profile_url: String(data.profile_url ?? ''),
    photo_url: String(data.photo_url ?? ''),
    logo_url: String(data.logo_url ?? ''),
    social_links: Array.isArray(data.social_links) ? data.social_links as SocialLink[] : [],
    show_name: data.show_name === 1 || data.show_name === true,
    show_job_title: data.show_job_title === 1 || data.show_job_title === true,
    show_company: data.show_company === 1 || data.show_company === true,
    show_phone: data.show_phone === 1 || data.show_phone === true,
    show_email: data.show_email === 1 || data.show_email === true,
    show_website: data.show_website === 1 || data.show_website === true,
    show_qr: data.show_qr === 1 || data.show_qr === true,
    show_social: data.show_social === 1 || data.show_social === true,
    show_photo: data.show_photo === 1 || data.show_photo === true,
    show_logo: data.show_logo === 1 || data.show_logo === true,
    accent_color: String(data.accent_color ?? '#3B82F6'),
    signature_by: String(data.signature_by ?? ''),
  };
}

// ── Logo / Photo upload widget ─────────────────────────────────────────────────

function ImageUploadField({
  label,
  value,
  onChange,
  slot,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  slot: 'logo' | 'photo';
  hint?: string;
}) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-detect mode from existing value
  useEffect(() => {
    if (value && value.startsWith('/airo-assets/uploads/signatures/')) {
      setMode('upload');
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image must be under 4 MB');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const res = await fetch(`/api/signatures/upload-image?slot=${slot}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const data = await res.json();
      if (data.success) {
        onChange(data.url);
      } else {
        setUploadError(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadError('Network error during upload');
    } finally {
      setUploading(false);
    }
  }, [slot, onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isUploaded = value && value.startsWith('/airo-assets/uploads/signatures/');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2.5 py-1 transition-colors ${mode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2.5 py-1 transition-colors ${mode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Upload
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-background border-border text-sm"
          placeholder="https://example.com/logo.png"
        />
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="relative"
        >
          {/* Preview strip if we have an image */}
          {value && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30 mb-2">
              <img
                src={value}
                alt={label}
                className="h-10 w-auto max-w-[80px] object-contain rounded"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground font-medium truncate">
                  {isUploaded ? 'Uploaded image' : 'External image'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{value}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {uploading ? 'Uploading…' : 'Click to upload or drag & drop'}
            </span>
            <span className="text-[10px] text-muted-foreground/60">PNG, JPG, SVG, WebP · max 4 MB</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {uploadError}
        </p>
      )}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Live Preview Panel ─────────────────────────────────────────────────────────

function LivePreviewPanel({
  htmlOutput,
  templateName,
  compact = false,
}: {
  htmlOutput: string;
  templateName: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${compact ? '' : 'sticky top-4'}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Live preview</span>
        </div>
        <Badge className="text-[10px] bg-muted text-muted-foreground border-0 font-normal">
          {templateName}
        </Badge>
      </div>
      <div className="bg-white p-4 overflow-x-auto min-h-[120px]">
        {htmlOutput ? (
          <div dangerouslySetInnerHTML={{ __html: htmlOutput }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <ImageIcon className="w-6 h-6 opacity-30" />
            <p className="text-xs">Fill in your details to see a preview</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EmailSignaturePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [form, setForm] = useState<SigForm>(DEFAULT_FORM);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState('');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'templates' | 'export'>('edit');
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [showSocialSection, setShowSocialSection] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [brandingText, setBrandingText] = useState('');
  const savingRef = useRef(false);

  const hasPlanAccess = !!(
    user?.hasBusinessAccess ||
    user?.hasStarterAccess ||
    user?.hasLifetimeAccess ||
    (user as { hasProfessionalAccess?: boolean })?.hasProfessionalAccess
  );

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [sigRes, profilesRes] = await Promise.all([
          fetch('/api/signatures/me', { credentials: 'include' }),
          fetch('/api/profiles/me', { credentials: 'include' }),
        ]);
        const [sigData, profilesData] = await Promise.all([
          sigRes.json(), profilesRes.json(),
        ]);

        setBrandingText('');
        setIsFree(!hasPlanAccess);

        let initialForm = { ...DEFAULT_FORM };
        if (sigData.success && sigData.data) {
          initialForm = apiToForm(sigData.data as Record<string, unknown>);
        } else if (profilesData.success && profilesData.data?.length > 0) {
          const p = profilesData.data[0] as Record<string, unknown>;
          initialForm = {
            ...DEFAULT_FORM,
            name: String(p.display_name ?? ''),
            job_title: String(p.job_title ?? ''),
            company: String(p.company ?? ''),
            phone: String(p.phone ?? ''),
            email: String(p.email ?? user?.email ?? ''),
            website: String(p.website ?? ''),
            photo_url: String(p.profile_photo ?? ''),
          };
          const slug = p.biz_slug ?? p.username;
          if (slug) {
            const base = window.location.origin;
            const url = `${base}/profile/${slug}`;
            initialForm.profile_url = url;
            setProfileUrl(url);
          }
        }

        setForm(initialForm);

        if (profilesData.success && profilesData.data?.length > 0) {
          const p = profilesData.data[0] as { id: number };
          const qrRes = await fetch(`/api/qr/${p.id}`, { credentials: 'include' });
          const qrData = await qrRes.json();
          if (qrData.success) setQrUrl(qrData.data.qr_data_url);
        }
      } catch {
        setError('Failed to load signature data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, hasPlanAccess]);

  // ── Derived HTML ─────────────────────────────────────────────────────────────

  const sigData = formToSignatureData(form, qrUrl);
  const sigDataWithBranding = {
    ...sigData,
    branding_text: isFree && brandingText ? brandingText : undefined,
  };
  const htmlOutput = renderSignatureHtml(sigDataWithBranding);
  const textOutput = renderSignaturePlainText(sigData);
  const selectedTemplate = SIGNATURE_TEMPLATES.find(t => t.id === form.template_id);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const setField = <K extends keyof SigForm>(key: K, value: SigForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const setSocialUrl = (platform: string, url: string) => {
    setForm(f => {
      const existing = f.social_links.filter(s => s.platform !== platform);
      if (url.trim()) return { ...f, social_links: [...existing, { platform, url: url.trim() }] };
      return { ...f, social_links: existing };
    });
  };

  const getSocialUrl = (platform: string) =>
    form.social_links.find(s => s.platform === platform)?.url ?? '';

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        show_name: form.show_name ? 1 : 0,
        show_job_title: form.show_job_title ? 1 : 0,
        show_company: form.show_company ? 1 : 0,
        show_phone: form.show_phone ? 1 : 0,
        show_email: form.show_email ? 1 : 0,
        show_website: form.show_website ? 1 : 0,
        show_qr: form.show_qr ? 1 : 0,
        show_social: form.show_social ? 1 : 0,
        show_photo: form.show_photo ? 1 : 0,
        show_logo: form.show_logo ? 1 : 0,
      };
      const res = await fetch('/api/signatures/me', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const handleCopyHtml = async () => {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const blob = new Blob([htmlOutput], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      } else {
        await navigator.clipboard.writeText(htmlOutput);
      }
    } catch {
      try {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(htmlOutput, 'text/html');
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;pointer-events:none;opacity:0;';
        while (parsed.body.firstChild) el.appendChild(parsed.body.firstChild);
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges(); sel?.addRange(range);
        document.execCommand('copy');
        sel?.removeAllRanges();
        document.body.removeChild(el);
      } catch { /* silent */ }
    }
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2500);
    fetch('/api/signatures/me/audit', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'signature.copy_html' }),
    }).catch(() => {});
  };

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(textOutput);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlOutput], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'email-signature.html'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch('/api/signatures/me', { method: 'DELETE', credentials: 'include' });
      setForm(DEFAULT_FORM);
      setShowDeleteConfirm(false);
    } catch {
      setError('Failed to delete signature');
    } finally {
      setDeleting(false);
    }
  };

  const selectTemplate = (t: SignatureTemplate) => {
    setField('template_id', t.id);
    fetch('/api/signatures/me/audit', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'signature.change_template' }),
    }).catch(() => {});
  };

  // ── Filtered templates ───────────────────────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    if (templateCategory === 'all') return SIGNATURE_TEMPLATES;
    return SIGNATURE_TEMPLATES.filter(t => t.category === templateCategory);
  }, [templateCategory]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0 space-y-4">
      <Skeleton className="h-8 w-56 mb-6" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  if (!featureEnabled) return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0">
      <Card className="bg-card border-border">
        <CardContent className="py-16 text-center">
          <FileSignature className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Email Signature Generator</h2>
          <p className="text-muted-foreground text-sm">This feature is currently disabled. Please contact support.</p>
        </CardContent>
      </Card>
    </div>
  );

  if (!hasPlanAccess) return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Email Signature — Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Card className="bg-card border-border">
        <CardContent className="py-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FileSignature className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Email Signature Generator</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Create a professional branded email signature. Available on Starter, Professional, Business, and Lifetime plans.
            </p>
          </div>
          <a href="/dashboard/billing">
            <Button className="bg-primary mt-2">View Plans &amp; Upgrade</Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Email Signature Generator — Dashboard</title>
        <meta name="description" content="Create and customise your professional email signature." />
        <link rel="canonical" href="/dashboard/email-signature" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" /> Email Signature Generator
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {SIGNATURE_TEMPLATES.length} professional templates · changes preview instantly
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="bg-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Signature'}
          </Button>
          <Button variant="outline" className="border-border gap-2" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" /> Reset
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Two-column layout: left = tabs, right = sticky preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left column: tabs ── */}
        <div>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
            <TabsList className="bg-muted/50 mb-5">
              <TabsTrigger value="edit">Edit Details</TabsTrigger>
              <TabsTrigger value="templates">
                Templates
                <Badge className="ml-1.5 text-xs bg-primary/10 text-primary border-0">{SIGNATURE_TEMPLATES.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            {/* ── Edit Tab ── */}
            <TabsContent value="edit" className="space-y-4">

              {/* Contact Details */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Contact Details
                  </CardTitle>
                  <CardDescription>These details appear in your signature</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Full Name</Label>
                      <Input value={form.name} onChange={e => setField('name', e.target.value)}
                        className="bg-background border-border" placeholder="Jane Smith" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Job Title</Label>
                      <Input value={form.job_title} onChange={e => setField('job_title', e.target.value)}
                        className="bg-background border-border" placeholder="Senior Designer" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Company</Label>
                      <Input value={form.company} onChange={e => setField('company', e.target.value)}
                        className="bg-background border-border" placeholder="JA Group Services Ltd" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Phone</Label>
                      <Input value={form.phone} onChange={e => setField('phone', e.target.value)}
                        className="bg-background border-border" placeholder="+44 7700 000000" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
                      <Input value={form.email} onChange={e => setField('email', e.target.value)}
                        className="bg-background border-border" placeholder="jane@jagroupservices.co.uk" type="email" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Website</Label>
                      <Input value={form.website} onChange={e => setField('website', e.target.value)}
                        className="bg-background border-border" placeholder="https://jagroupservices.co.uk" />
                    </div>
                  </div>

                  {/* Profile / QR URL */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Profile / QR Code URL</Label>
                    <Input value={form.profile_url} onChange={e => setField('profile_url', e.target.value)}
                      className="bg-background border-border"
                      placeholder={profileUrl || 'https://japrofilestudio.jagroupservices.co.uk/profile/…'} />
                    <p className="text-xs text-muted-foreground mt-1">The QR code will link to this URL</p>
                  </div>

                  {/* Photo upload */}
                  <ImageUploadField
                    label="Profile Photo"
                    value={form.photo_url}
                    onChange={url => setField('photo_url', url)}
                    slot="photo"
                    hint="Shown as your headshot in the signature"
                  />

                  {/* Logo upload */}
                  <ImageUploadField
                    label="Company Logo (optional)"
                    value={form.logo_url}
                    onChange={url => setField('logo_url', url)}
                    slot="logo"
                    hint="Upload your logo or paste a URL — enable it in Show/Hide below"
                  />

                  {/* Accent colour */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <Palette className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Label className="text-sm text-foreground">Accent Colour</Label>
                    <input type="color" value={form.accent_color}
                      onChange={e => setField('accent_color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-background p-0.5" />
                    <span className="text-xs text-muted-foreground font-mono">{form.accent_color}</span>
                  </div>

                  {/* Sign-off */}
                  <div className="pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Sign-off line (optional)
                    </Label>
                    <Input
                      value={form.signature_by}
                      onChange={e => setField('signature_by', e.target.value)}
                      className="bg-background border-border"
                      placeholder="e.g. Kind regards, Jane — or leave blank"
                      maxLength={120}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Appears above your signature block (e.g. "Kind regards,")
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Show / Hide Fields */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" /> Show / Hide Fields
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      ['show_name',      'Name'],
                      ['show_job_title', 'Job Title'],
                      ['show_company',   'Company'],
                      ['show_phone',     'Phone'],
                      ['show_email',     'Email'],
                      ['show_website',   'Website'],
                      ['show_photo',     'Profile Photo'],
                      ['show_logo',      'Logo'],
                      ['show_qr',        'QR Code'],
                      ['show_social',    'Social Buttons'],
                    ] as [keyof SigForm, string][]).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border">
                        <span className="text-sm text-foreground">{label}</span>
                        <Switch
                          checked={form[key] as boolean}
                          onCheckedChange={v => setField(key, v as SigForm[typeof key])}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Social Links */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowSocialSection(s => !s)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-muted-foreground" /> Social Media Links
                      {form.social_links.length > 0 && (
                        <Badge className="text-xs bg-primary/10 text-primary border-0">{form.social_links.length} added</Badge>
                      )}
                    </CardTitle>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSocialSection ? 'rotate-180' : ''}`} />
                  </div>
                  <CardDescription>Add links that appear as buttons in your signature</CardDescription>
                </CardHeader>
                {showSocialSection && (
                  <CardContent className="space-y-3">
                    {SOCIAL_PLATFORMS.map(p => (
                      <div key={p.id}>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">{p.label}</Label>
                        <Input
                          value={getSocialUrl(p.id)}
                          onChange={e => setSocialUrl(p.id, e.target.value)}
                          className="bg-background border-border"
                          placeholder={p.placeholder}
                        />
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ── Templates Tab ── */}
            <TabsContent value="templates">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setTemplateCategory('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${templateCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  All ({SIGNATURE_TEMPLATES.length})
                </button>
                {TEMPLATE_CATEGORIES.map(cat => {
                  const count = SIGNATURE_TEMPLATES.filter(t => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${templateCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {filteredTemplates.map(t => {
                  const isSelected = form.template_id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className={`text-left p-3 rounded-xl border transition-all ${isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'}`}
                    >
                      {/* Mini preview */}
                      <div className="w-full h-20 rounded-lg mb-3 overflow-hidden border border-border/50 bg-white relative">
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ transform: 'scale(0.38)', transformOrigin: 'top left', width: '263%', height: '263%' }}
                          dangerouslySetInnerHTML={{
                            __html: renderSignatureHtml({
                              ...formToSignatureData(form, null),
                              template_id: t.id,
                              name: form.name || 'Jane Smith',
                              job_title: form.job_title || 'Senior Designer',
                              company: form.company || 'JA Group Services Ltd',
                              email: form.email || 'jane@example.com',
                              phone: form.phone || '+44 7700 000000',
                              show_qr: 0,
                            }),
                          }}
                        />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{t.layout}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{t.colorScheme}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{t.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Export Tab ── */}
            <TabsContent value="export" className="space-y-4">

              {isFree && brandingText && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-400">Free plan — signature includes branding</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your signature will include "<span className="text-foreground">{brandingText}</span>" at the bottom. Upgrade to remove this.</p>
                  </div>
                </div>
              )}

              {/* Copy CTA */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-muted-foreground" /> Add to Your Email Client
                  </CardTitle>
                  <CardDescription>Copy your signature and paste it directly into Gmail, Outlook, or Apple Mail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Step 1 — Copy your signature</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Copies as rich text — paste into your email client and it will look exactly like the preview, not as code.
                      </p>
                    </div>
                    <button
                      onClick={handleCopyHtml}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        copiedHtml ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {copiedHtml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedHtml ? 'Copied! Now paste into your email client' : 'Copy Signature'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Step 2 — Paste into your email client</p>
                    {[
                      {
                        client: 'Gmail',
                        steps: ['Click the gear icon → See all settings', 'Go to the General tab → scroll to Signature', 'Create new or select an existing signature', 'Click inside the signature editor, then paste (Ctrl+V / Cmd+V)', 'Click Save Changes at the bottom'],
                      },
                      {
                        client: 'Outlook (Desktop)',
                        steps: ['Go to File → Options → Mail → Signatures', 'Click New and give it a name', 'Click inside the signature editor, then paste (Ctrl+V)', 'Click OK to save'],
                      },
                      {
                        client: 'Apple Mail',
                        steps: ['Go to Mail → Preferences → Signatures', 'Click + to add a new signature', 'Uncheck "Always match my default message font"', 'Click inside the signature area, then paste (Cmd+V)'],
                      },
                    ].map(({ client, steps }) => (
                      <details key={client} className="group rounded-xl border border-border bg-muted/20 overflow-hidden">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                          {client}
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                        </summary>
                        <ol className="px-4 pb-4 pt-1 space-y-1.5 list-decimal list-inside">
                          {steps.map((s, i) => <li key={i} className="text-xs text-muted-foreground">{s}</li>)}
                        </ol>
                      </details>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Other options</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button onClick={handleDownloadHtml} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left">
                        <Download className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Download HTML file</p>
                          <p className="text-xs text-muted-foreground">For email clients that accept .html uploads</p>
                        </div>
                      </button>
                      <button onClick={handleCopyText} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left">
                        {copiedText ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <Copy className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-medium text-foreground">{copiedText ? 'Copied!' : 'Copy plain text'}</p>
                          <p className="text-xs text-muted-foreground">For clients that don't support HTML</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Right column: sticky live preview ── */}
        <div className="hidden lg:block">
          <LivePreviewPanel
            htmlOutput={htmlOutput}
            templateName={selectedTemplate?.name ?? form.template_id}
          />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Updates as you type · white background = email client view
          </p>
        </div>
      </div>

      {/* Mobile preview (below tabs) */}
      <div className="lg:hidden mt-6">
        <LivePreviewPanel
          htmlOutput={htmlOutput}
          templateName={selectedTemplate?.name ?? form.template_id}
          compact
        />
      </div>

      {/* Delete / Reset confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border max-w-sm w-full">
            <CardHeader>
              <CardTitle className="text-base">Reset Signature?</CardTitle>
              <CardDescription>This will delete your saved signature and reset all fields. This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
