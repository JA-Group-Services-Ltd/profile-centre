/**
 * Business Cards — Customer Dashboard
 * Two options: Upload Own Design | Request Custom Design
 * No auto-builder — customers supply artwork or request custom design from the team.
 */
import { useState, useEffect, useRef } from 'react';
import { fmtDate, fmtTime } from '@/lib/date';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Upload, Paintbrush, ChevronRight, ChevronLeft, ArrowLeft,
  CheckCircle, Clock, AlertCircle, Send, MessageSquare, Download,
  FileText, Info, Lock, Eye, Star, Layers, Palette,
  Type, QrCode, LayoutTemplate, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAuth } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  front_bg_color: string;
  front_text_color: string;
  front_accent_color: string;
  layout_style: string;
  supports_back: number;
  is_premium?: number;
}

interface Order {
  id: number;
  request_type: string;
  status: string;
  created_at: string;
  name_on_card: string;
  business_name_on_card: string;
  quantity: number;
  total_quoted: number;
  stripe_payment_status: string;
  proof_url: string;
  final_file_enabled: number;
  final_file_url: string;
  customer_approved: number;
  design_deposit_amount: number;
  design_deposit_paid: number;
  stripe_payment_link: string;
  stripe_invoice_url: string;
}

interface Message {
  id: number;
  sender_type: 'customer' | 'admin';
  sender_name: string;
  message: string;
  created_at: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:                    { label: 'Draft',                    color: 'bg-gray-100 text-gray-700',      icon: <FileText className="w-3 h-3" /> },
  submitted:                { label: 'Submitted for Review',     color: 'bg-blue-100 text-blue-700',      icon: <Clock className="w-3 h-3" /> },
  awaiting_admin_review:    { label: 'Awaiting Admin Review',    color: 'bg-orange-500/10 text-orange-400',  icon: <Clock className="w-3 h-3" /> },
  changes_requested:        { label: 'Changes Requested',        color: 'bg-orange-100 text-orange-700',  icon: <AlertCircle className="w-3 h-3" /> },
  price_quoted:             { label: 'Price Being Confirmed',    color: 'bg-purple-100 text-purple-700',  icon: <Info className="w-3 h-3" /> },
  design_deposit_required:  { label: 'Design Deposit Required',  color: 'bg-blue-500/10 text-blue-400',    icon: <AlertCircle className="w-3 h-3" /> },
  payment_link_sent:        { label: 'Payment Link Sent',        color: 'bg-indigo-100 text-indigo-700',  icon: <Send className="w-3 h-3" /> },
  awaiting_payment:         { label: 'Awaiting Payment',         color: 'bg-orange-100 text-orange-700',  icon: <Clock className="w-3 h-3" /> },
  paid_design_can_start:    { label: 'Payment Received',         color: 'bg-green-100 text-green-700',    icon: <CheckCircle className="w-3 h-3" /> },
  design_work_can_start:    { label: 'Design Work in Progress',  color: 'bg-teal-100 text-teal-700',      icon: <Paintbrush className="w-3 h-3" /> },
  awaiting_customer_approval: { label: 'Proof Awaiting Approval', color: 'bg-blue-100 text-blue-700',    icon: <Eye className="w-3 h-3" /> },
  approved_for_print:       { label: 'Approved by You',          color: 'bg-green-100 text-green-700',    icon: <CheckCircle className="w-3 h-3" /> },
  final_file_enabled:       { label: 'Final File Enabled',       color: 'bg-emerald-100 text-emerald-700', icon: <Download className="w-3 h-3" /> },
  ready_for_print:          { label: 'Ready for Print',          color: 'bg-teal-100 text-teal-700',      icon: <Package className="w-3 h-3" /> },
  ordered_with_provider:    { label: 'Ordered with Provider',    color: 'bg-cyan-100 text-cyan-700',      icon: <Package className="w-3 h-3" /> },
  in_production:            { label: 'In Production',            color: 'bg-blue-100 text-blue-700',      icon: <Layers className="w-3 h-3" /> },
  dispatched:               { label: 'Dispatched',               color: 'bg-green-100 text-green-700',    icon: <CheckCircle className="w-3 h-3" /> },
  completed:                { label: 'Completed',                color: 'bg-green-100 text-green-700',    icon: <CheckCircle className="w-3 h-3" /> },
  cancelled:                { label: 'Cancelled',                color: 'bg-red-100 text-red-700',        icon: <AlertCircle className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700', icon: <Info className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Card Builder Preview ─────────────────────────────────────────────────────

interface BuilderData {
  template_id: number | null;
  name_on_card: string;
  business_name_on_card: string;
  role_on_card: string;
  phone_on_card: string;
  email_on_card: string;
  website_on_card: string;
  tagline_on_card: string;
  address_on_card: string;
  front_bg_color: string;
  front_text_color: string;
  front_accent_color: string;
  font_choice: string;
  qr_required: boolean;
  front_back_preference: string;
  quantity: number;
  card_size: string;
  finish: string;
  corner_type: string;
  customer_notes: string;
  // Optional add-ons
  addon_lamination: boolean;
  addon_foil: boolean;
  addon_spot_uv: boolean;
  addon_embossing: boolean;
  addon_qr_code: boolean;
  addon_rush_delivery: boolean;
  addon_eco_stock: boolean;
  addon_thick_stock: boolean;
}

function CardPreview({ data, template }: { data: BuilderData; template: CardTemplate | null }) {
  const bg = data.front_bg_color || template?.front_bg_color || '#1e3a5f';
  const text = data.front_text_color || template?.front_text_color || '#ffffff';
  const accent = data.front_accent_color || template?.front_accent_color || '#c8a96e';
  const layout = template?.layout_style || 'classic';

  return (
    <div className="relative" style={{ width: '340px', height: '204px' }}>
      {/* Card */}
      <div
        className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden"
        style={{ background: bg, color: text, fontFamily: data.font_choice || 'Inter' }}
      >
        {/* Safe area guide */}
        <div className="absolute inset-[8px] border border-dashed opacity-20 rounded-lg pointer-events-none" style={{ borderColor: text }} />

        {/* PROOF watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: 'rotate(-20deg)' }}>
          <span className="text-3xl font-black opacity-10 tracking-widest select-none" style={{ color: text }}>PROOF ONLY</span>
        </div>

        {layout === 'qr_focus' ? (
          // QR Focus layout
          <div className="absolute inset-0 flex">
            <div className="flex-1 flex flex-col justify-center px-5 py-4">
              <div className="text-xs font-semibold mb-1" style={{ color: accent }}>{data.business_name_on_card || 'Business Name'}</div>
              <div className="text-base font-bold leading-tight">{data.name_on_card || 'Your Name'}</div>
              <div className="text-xs mt-1 opacity-80">{data.role_on_card || 'Job Title'}</div>
              <div className="mt-3 space-y-0.5">
                {data.phone_on_card && <div className="text-xs opacity-70">{data.phone_on_card}</div>}
                {data.email_on_card && <div className="text-xs opacity-70">{data.email_on_card}</div>}
              </div>
            </div>
            <div className="w-20 flex items-center justify-center" style={{ background: accent + '22' }}>
              <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: text + '22' }}>
                <QrCode className="w-8 h-8 opacity-60" style={{ color: text }} />
              </div>
            </div>
          </div>
        ) : layout === 'bold' ? (
          // Bold Modern layout
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div>
              <div className="text-xl font-black tracking-tight">{data.name_on_card || 'Your Name'}</div>
              <div className="text-sm font-medium mt-0.5" style={{ color: accent }}>{data.role_on_card || 'Job Title'}</div>
            </div>
            <div className="flex items-end justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold opacity-80">{data.business_name_on_card || 'Business Name'}</div>
                {data.phone_on_card && <div className="text-xs opacity-60">{data.phone_on_card}</div>}
                {data.email_on_card && <div className="text-xs opacity-60">{data.email_on_card}</div>}
              </div>
              {data.qr_required && (
                <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: accent + '33' }}>
                  <QrCode className="w-6 h-6 opacity-60" style={{ color: accent }} />
                </div>
              )}
            </div>
          </div>
        ) : layout === 'minimal' ? (
          // Minimal Professional
          <div className="absolute inset-0 flex flex-col justify-center px-6 py-4">
            <div className="h-px w-8 mb-3" style={{ background: accent }} />
            <div className="text-lg font-semibold">{data.name_on_card || 'Your Name'}</div>
            <div className="text-xs mt-0.5 opacity-70">{data.role_on_card || 'Job Title'}</div>
            <div className="text-xs mt-0.5 font-medium" style={{ color: accent }}>{data.business_name_on_card || 'Business Name'}</div>
            <div className="h-px w-full mt-3 mb-2 opacity-20" style={{ background: text }} />
            <div className="flex gap-3 text-xs opacity-60">
              {data.phone_on_card && <span>{data.phone_on_card}</span>}
              {data.email_on_card && <span>{data.email_on_card}</span>}
            </div>
          </div>
        ) : (
          // Classic / Corporate / Premium
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-bold">{data.name_on_card || 'Your Name'}</div>
                <div className="text-xs mt-0.5 opacity-80">{data.role_on_card || 'Job Title'}</div>
                <div className="text-xs mt-0.5 font-semibold" style={{ color: accent }}>{data.business_name_on_card || 'Business Name'}</div>
              </div>
              {data.qr_required && (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: accent + '22' }}>
                  <QrCode className="w-7 h-7 opacity-60" style={{ color: accent }} />
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              {data.phone_on_card && <div className="text-xs opacity-70">{data.phone_on_card}</div>}
              {data.email_on_card && <div className="text-xs opacity-70">{data.email_on_card}</div>}
              {data.website_on_card && <div className="text-xs opacity-70">{data.website_on_card}</div>}
              {data.tagline_on_card && <div className="text-xs italic opacity-50 mt-1">{data.tagline_on_card}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Builder Step ─────────────────────────────────────────────────────────────

function BuilderStep({ onSubmit, onBack }: { onSubmit: (data: BuilderData) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [step, setStep] = useState<'template' | 'edit' | 'options' | 'review'>('template');
  const [data, setData] = useState<BuilderData>({
    template_id: null,
    name_on_card: (user as any)?.name || '',
    business_name_on_card: '',
    role_on_card: '',
    phone_on_card: '',
    email_on_card: (user as any)?.email || '',
    website_on_card: '',
    tagline_on_card: '',
    address_on_card: '',
    front_bg_color: '',
    front_text_color: '',
    front_accent_color: '',
    font_choice: 'Inter',
    qr_required: true,
    front_back_preference: 'double',
    quantity: 50,
    card_size: '85x55',
    finish: 'matte',
    corner_type: 'square',
    customer_notes: '',
    addon_lamination: false,
    addon_foil: false,
    addon_spot_uv: false,
    addon_embossing: false,
    addon_qr_code: false,
    addon_rush_delivery: false,
    addon_eco_stock: false,
    addon_thick_stock: false,
  });

  useEffect(() => {
    fetch('/api/business-cards/templates').then(r => r.json()).then(d => setTemplates(d.templates || []));
  }, []);

  const selectedTemplate = templates.find(t => t.id === data.template_id) ?? null;

  const set = (k: keyof BuilderData, v: any) => setData(prev => ({ ...prev, [k]: v }));

  const selectTemplate = (t: CardTemplate) => {
    setData(prev => ({
      ...prev,
      template_id: t.id,
      front_bg_color: t.front_bg_color,
      front_text_color: t.front_text_color,
      front_accent_color: t.front_accent_color,
    }));
    setStep('edit');
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm">
        {(['template', 'edit', 'options', 'review'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <button
              onClick={() => { if (i < ['template','edit','options','review'].indexOf(step) + 1) setStep(s); }}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${step === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {i + 1}. {s === 'template' ? 'Template' : s === 'edit' ? 'Edit Card' : s === 'options' ? 'Options' : 'Review'}
            </button>
          </div>
        ))}
      </div>

      {/* Step: Template selection */}
      {step === 'template' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Choose a Template</h3>
            <p className="text-sm text-muted-foreground mt-1">Select a starting design. You can customise colours, text and layout in the next step.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 && (
              <div className="col-span-3 text-center py-8 text-muted-foreground text-sm">Loading templates…</div>
            )}
            {templates.map(t => (
              <button key={t.id} onClick={() => selectTemplate(t)}
                className="group text-left border-2 rounded-xl p-4 hover:border-primary transition-all hover:shadow-md"
                style={{ borderColor: data.template_id === t.id ? 'hsl(var(--primary))' : undefined }}
              >
                {/* Mini preview */}
                <div className="rounded-lg overflow-hidden mb-3 shadow-sm" style={{ background: t.front_bg_color, height: '80px', position: 'relative' }}>
                  <div className="absolute inset-0 p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold" style={{ color: t.front_text_color }}>Your Name</div>
                      <div className="text-xs opacity-70" style={{ color: t.front_accent_color }}>Job Title</div>
                    </div>
                    <div className="text-xs opacity-50" style={{ color: t.front_text_color }}>Business Name</div>
                  </div>
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                {t.is_premium === 1 && <Badge variant="secondary" className="mt-2 text-xs">Premium</Badge>}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          </div>
        </div>
      )}

      {/* Step: Edit card */}
      {step === 'edit' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Edit Your Card</h3>
            <p className="text-sm text-muted-foreground mt-1">Fill in your details. Keep important text, logos and QR codes inside the safe area.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Live preview */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Live Preview (Proof Only)</div>
              <CardPreview data={data} template={selectedTemplate} />
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400">
                <strong>Proof only.</strong> This preview is for review only and is not print-ready. Final files and printing require admin review and payment.
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                Your QR code must remain clear, readable and inside the safe print area. Admin may request changes if the design is not suitable for printing.
              </div>
            </div>

            {/* Edit fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name on Card</Label>
                  <Input value={data.name_on_card} onChange={e => set('name_on_card', e.target.value)} placeholder="Your full name" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Name</Label>
                  <Input value={data.business_name_on_card} onChange={e => set('business_name_on_card', e.target.value)} placeholder="Company / business" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role / Job Title</Label>
                  <Input value={data.role_on_card} onChange={e => set('role_on_card', e.target.value)} placeholder="e.g. Director" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone Number</Label>
                  <Input value={data.phone_on_card} onChange={e => set('phone_on_card', e.target.value)} placeholder="+44 7700 000000" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Address</Label>
                  <Input value={data.email_on_card} onChange={e => set('email_on_card', e.target.value)} placeholder="you@example.com" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input value={data.website_on_card} onChange={e => set('website_on_card', e.target.value)} placeholder="www.example.com" className="text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Tagline (optional)</Label>
                  <Input value={data.tagline_on_card} onChange={e => set('tagline_on_card', e.target.value)} placeholder="Short tagline or strapline" className="text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Address (optional)</Label>
                  <Input value={data.address_on_card} onChange={e => set('address_on_card', e.target.value)} placeholder="Business address" className="text-sm" />
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium flex items-center gap-2"><Palette className="w-4 h-4" />Colours</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Background</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={data.front_bg_color || selectedTemplate?.front_bg_color || '#1e3a5f'}
                      onChange={e => set('front_bg_color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-border" />
                    <Input value={data.front_bg_color || selectedTemplate?.front_bg_color || '#1e3a5f'}
                      onChange={e => set('front_bg_color', e.target.value)} className="text-xs h-8 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Text</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={data.front_text_color || selectedTemplate?.front_text_color || '#ffffff'}
                      onChange={e => set('front_text_color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-border" />
                    <Input value={data.front_text_color || selectedTemplate?.front_text_color || '#ffffff'}
                      onChange={e => set('front_text_color', e.target.value)} className="text-xs h-8 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Accent</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={data.front_accent_color || selectedTemplate?.front_accent_color || '#c8a96e'}
                      onChange={e => set('front_accent_color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-border" />
                    <Input value={data.front_accent_color || selectedTemplate?.front_accent_color || '#c8a96e'}
                      onChange={e => set('front_accent_color', e.target.value)} className="text-xs h-8 font-mono" />
                  </div>
                </div>
              </div>

              <Separator />
              <div className="text-sm font-medium flex items-center gap-2"><Type className="w-4 h-4" />Font</div>
              <Select value={data.font_choice} onValueChange={v => set('font_choice', v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Merriweather', 'Source Sans 3'].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={data.qr_required} onChange={e => set('qr_required', e.target.checked)} className="rounded" />
                  <QrCode className="w-4 h-4" />
                  Include JA Profile Studio QR code
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('template')}><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
            <Button onClick={() => setStep('options')}>Next: Card Options <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Card options */}
      {step === 'options' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Card Options</h3>
            <p className="text-sm text-muted-foreground mt-1">Choose your card specifications. Available options are subject to provider availability and admin confirmation before payment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Select value={String(data.quantity)} onValueChange={v => set('quantity', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 250, 500, 1000].map(q => <SelectItem key={q} value={String(q)}>{q} cards</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Card Size</Label>
              <Select value={data.card_size} onValueChange={v => set('card_size', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="85x55">Standard (85 × 55mm)</SelectItem>
                  <SelectItem value="65x65">Square (65 × 65mm)</SelectItem>
                  <SelectItem value="85x40">Slim (85 × 40mm)</SelectItem>
                  <SelectItem value="87x49">Credit Card (87 × 49mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Finish</Label>
              <Select value={data.finish} onValueChange={v => set('finish', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="matte">Matte</SelectItem>
                  <SelectItem value="gloss">Glossy</SelectItem>
                  <SelectItem value="uncoated">Uncoated</SelectItem>
                  <SelectItem value="kraft">Kraft</SelectItem>
                  <SelectItem value="pearl">Pearl (where available)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Corner Type</Label>
              <Select value={data.corner_type} onValueChange={v => set('corner_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square Corners</SelectItem>
                  <SelectItem value="rounded">Rounded Corners</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sides</Label>
              <Select value={data.front_back_preference} onValueChange={v => set('front_back_preference', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="double">Double-sided</SelectItem>
                  <SelectItem value="single">Single-sided</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes for Admin (optional)</Label>
            <Textarea value={data.customer_notes} onChange={e => set('customer_notes', e.target.value)}
              placeholder="Any special requirements, preferences or questions for admin…" rows={3} />
          </div>

          {/* Optional Add-ons */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Optional Add-ons</p>
              <p className="text-xs text-muted-foreground mt-0.5">Select any extras you would like to request. All add-ons are subject to availability and admin confirmation. Additional charges apply.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'addon_lamination',     label: 'Lamination',           hint: 'Protective laminate coating (matte or gloss)' },
                { key: 'addon_foil',           label: 'Foil Finish',          hint: 'Gold, silver, or holographic foil accents' },
                { key: 'addon_spot_uv',        label: 'Spot UV',              hint: 'Glossy UV coating on selected areas' },
                { key: 'addon_embossing',      label: 'Embossing / Debossing', hint: 'Raised or recessed text/logo effect' },
                { key: 'addon_qr_code',        label: 'QR Code on Card',      hint: 'Print your JA Profile Studio QR code on the card' },
                { key: 'addon_rush_delivery',  label: 'Rush / Express Delivery', hint: 'Faster turnaround — subject to availability' },
                { key: 'addon_eco_stock',      label: 'Eco / Recycled Stock', hint: 'Printed on recycled or FSC-certified card stock' },
                { key: 'addon_thick_stock',    label: 'Extra Thick Stock',    hint: '600gsm or above — premium feel' },
              ].map(addon => (
                <label key={addon.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  data[addon.key] ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={!!data[addon.key]}
                    onChange={e => set(addon.key, e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{addon.label}</p>
                    <p className="text-xs text-muted-foreground">{addon.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3">
              Add-on pricing is confirmed by admin after review. No charges are applied until you receive and approve a Stripe payment link or invoice.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            Options shown are subject to provider availability and admin confirmation before payment. Available sizes may depend on the selected print provider and availability at the time of order.
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('edit')}><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
            <Button onClick={() => setStep('review')}>Review & Submit <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Review Your Submission</h3>
            <p className="text-sm text-muted-foreground mt-1">Check your design and details before submitting to admin for review.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Card Preview (Proof Only)</div>
              <CardPreview data={data} template={selectedTemplate} />
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Template:</span> <span className="font-medium">{selectedTemplate?.name || '—'}</span></div>
                <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{data.quantity}</span></div>
                <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{data.card_size}mm</span></div>
                <div><span className="text-muted-foreground">Finish:</span> <span className="font-medium capitalize">{data.finish}</span></div>
                <div><span className="text-muted-foreground">Corners:</span> <span className="font-medium capitalize">{data.corner_type}</span></div>
                <div><span className="text-muted-foreground">Sides:</span> <span className="font-medium capitalize">{data.front_back_preference}</span></div>
              </div>
              {/* Add-ons summary */}
              {[
                { key: 'addon_lamination', label: 'Lamination' },
                { key: 'addon_foil', label: 'Foil Finish' },
                { key: 'addon_spot_uv', label: 'Spot UV' },
                { key: 'addon_embossing', label: 'Embossing / Debossing' },
                { key: 'addon_qr_code', label: 'QR Code on Card' },
                { key: 'addon_rush_delivery', label: 'Rush / Express Delivery' },
                { key: 'addon_eco_stock', label: 'Eco / Recycled Stock' },
                { key: 'addon_thick_stock', label: 'Extra Thick Stock' },
              ].some(a => data[a.key as keyof BuilderData]) && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Add-ons requested:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'addon_lamination', label: 'Lamination' },
                      { key: 'addon_foil', label: 'Foil Finish' },
                      { key: 'addon_spot_uv', label: 'Spot UV' },
                      { key: 'addon_embossing', label: 'Embossing / Debossing' },
                      { key: 'addon_qr_code', label: 'QR Code on Card' },
                      { key: 'addon_rush_delivery', label: 'Rush / Express Delivery' },
                      { key: 'addon_eco_stock', label: 'Eco / Recycled Stock' },
                      { key: 'addon_thick_stock', label: 'Extra Thick Stock' },
                    ].filter(a => data[a.key as keyof BuilderData]).map(a => (
                      <span key={a.key} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{a.label}</span>
                    ))}
                  </div>
                </div>
              )}
              <Separator />
              <div className="space-y-1">
                {data.name_on_card && <div><span className="text-muted-foreground">Name:</span> {data.name_on_card}</div>}
                {data.business_name_on_card && <div><span className="text-muted-foreground">Business:</span> {data.business_name_on_card}</div>}
                {data.role_on_card && <div><span className="text-muted-foreground">Role:</span> {data.role_on_card}</div>}
                {data.phone_on_card && <div><span className="text-muted-foreground">Phone:</span> {data.phone_on_card}</div>}
                {data.email_on_card && <div><span className="text-muted-foreground">Email:</span> {data.email_on_card}</div>}
                {data.website_on_card && <div><span className="text-muted-foreground">Website:</span> {data.website_on_card}</div>}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400 space-y-2">
            <p className="font-semibold">Pricing</p>
            <p>Business Cards are a paid add-on service. Your JA Profile Studio plan may allow access to the Business Cards area, but printed cards, provider costs, delivery, premium finishes, custom design, editing, setup and related services are charged separately unless expressly confirmed otherwise in writing.</p>
            <p>Prices shown or quoted do not include VAT unless VAT is expressly shown. JA Group Services Ltd is not currently VAT registered. If VAT registration applies in the future, VAT settings may be enabled by admin and VAT may be added where required.</p>
            <p className="font-medium">Payment will be requested using a Stripe invoice or Stripe payment link after admin has reviewed your request and confirmed the final price.</p>
            <p>Only pay using an official Stripe invoice or Stripe payment link issued by JA Profile Studio / JA Group Services Ltd.</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('options')}><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
            <Button onClick={() => onSubmit(data)} className="gap-2"><Send className="w-4 h-4" />Submit for Admin Review</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Own Design Form ───────────────────────────────────────────────────

function UploadDesignForm({ onSubmit, onBack }: { onSubmit: (data: any) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name_on_card: (user as any)?.name || '',
    email_on_card: (user as any)?.email || '',
    business_name_on_card: '',
    upload_file_type: 'pdf',
    upload_front_url: '',
    upload_back_url: '',
    quantity: '50',
    card_size: '85x55',
    finish: 'matte',
    corner_type: 'square',
    delivery_address: '',
    customer_notes: '',
    confirmed: false,
  });
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Upload Your Own Design</h3>
        <p className="text-sm text-muted-foreground mt-1">Already have a business card design? Upload your artwork or print file and we will review it for printing. Admin will confirm the final price before payment or printing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Your Name</Label>
          <Input value={form.name_on_card} onChange={e => set('name_on_card', e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input value={form.email_on_card} onChange={e => set('email_on_card', e.target.value)} placeholder="your@email.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Business Name</Label>
          <Input value={form.business_name_on_card} onChange={e => set('business_name_on_card', e.target.value)} placeholder="Company / business name" />
        </div>
        <div className="space-y-1.5">
          <Label>File Type</Label>
          <Select value={form.upload_file_type} onValueChange={v => set('upload_file_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpg">JPG / JPEG</SelectItem>
              <SelectItem value="svg">SVG</SelectItem>
              <SelectItem value="other">Other / Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Front Design File URL</Label>
          <Input value={form.upload_front_url} onChange={e => set('upload_front_url', e.target.value)} placeholder="Link to your front design file" />
          <p className="text-xs text-muted-foreground">Paste a link to your file (Google Drive, Dropbox, etc.) or describe it in the notes below.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Back Design File URL (optional)</Label>
          <Input value={form.upload_back_url} onChange={e => set('upload_back_url', e.target.value)} placeholder="Link to your back design file (if double-sided)" />
        </div>
        <div className="space-y-1.5">
          <Label>Quantity Wanted</Label>
          <Select value={form.quantity} onValueChange={v => set('quantity', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['25', '50', '100', '250', '500', '1000'].map(q => <SelectItem key={q} value={q}>{q} cards</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Card Size</Label>
          <Select value={form.card_size} onValueChange={v => set('card_size', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="85x55">Standard (85 × 55mm)</SelectItem>
              <SelectItem value="65x65">Square (65 × 65mm)</SelectItem>
              <SelectItem value="85x40">Slim (85 × 40mm)</SelectItem>
              <SelectItem value="87x49">Credit Card (87 × 49mm)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Finish</Label>
          <Select value={form.finish} onValueChange={v => set('finish', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="matte">Matte</SelectItem>
              <SelectItem value="gloss">Glossy</SelectItem>
              <SelectItem value="uncoated">Uncoated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Corner Type</Label>
          <Select value={form.corner_type} onValueChange={v => set('corner_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Square Corners</SelectItem>
              <SelectItem value="rounded">Rounded Corners</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Delivery Address or Area (optional)</Label>
          <Input value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder="Delivery address or area if known" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes for Admin</Label>
          <Textarea value={form.customer_notes} onChange={e => set('customer_notes', e.target.value)}
            placeholder="Describe your design, any special requirements, or paste file details here…" rows={4} />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Accepted file types</p>
        <p>PDF, PNG, JPG, SVG (where supported), existing design files, screenshots or reference images. Front and back design files accepted.</p>
        <p className="mt-1">Uploaded files do not automatically guarantee print readiness. Admin may request changes or confirm whether artwork preparation is required.</p>
      </div>

      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400 space-y-1">
        <p className="font-semibold">Pricing</p>
        <p>Business Cards are a paid add-on service. Printed cards, provider costs, delivery, premium finishes, artwork preparation and related services are charged separately. Admin will confirm the final price before payment or printing.</p>
        <p>Prices shown or quoted do not include VAT unless VAT is expressly shown. JA Group Services Ltd is not currently VAT registered.</p>
        <p className="font-medium">Only pay using an official Stripe invoice or Stripe payment link issued by JA Profile Studio / JA Group Services Ltd.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={form.confirmed} onChange={e => set('confirmed', e.target.checked)} className="mt-0.5 rounded" />
        <span className="text-sm">I understand this is a request for review only and does not place a confirmed print order.</span>
      </label>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button disabled={!form.confirmed || !form.name_on_card || !form.email_on_card}
          onClick={() => onSubmit({ ...form, request_type: 'upload_own', quantity: Number(form.quantity), has_own_design: 1 })}
          className="gap-2">
          <Send className="w-4 h-4" />Submit for Admin Review
        </Button>
      </div>
    </div>
  );
}

// ─── Custom Design Request Form ───────────────────────────────────────────────

function CustomDesignForm({ onSubmit, onBack }: { onSubmit: (data: any) => void; onBack: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name_on_card: (user as any)?.name || '',
    email_on_card: (user as any)?.email || '',
    business_name_on_card: '',
    role_on_card: '',
    phone_on_card: '',
    website_on_card: '',
    tagline_on_card: '',
    address_on_card: '',
    brand_colors: '',
    style_preference: '',
    front_back_preference: 'double',
    qr_required: true,
    quantity: '50',
    card_size: '85x55',
    finish: 'matte',
    corner_type: 'square',
    customer_notes: '',
    confirmed: false,
  });
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Request Custom Design</h3>
        <p className="text-sm text-muted-foreground mt-1">If you do not have a finished design, JA Profile Studio can create or prepare a business card design for you. Custom design requires a setup deposit from £15 upfront before work begins.</p>
      </div>

      <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Star className="w-4 h-4" />
          Design Setup Deposit from £15 Upfront
        </div>
        <p className="text-muted-foreground text-xs">The design setup deposit contributes towards initial admin review, design preparation, artwork setup and reserving design time. The final design fee, printing, provider costs, delivery and premium options may be quoted separately before you proceed.</p>
        <p className="text-muted-foreground text-xs">The design setup deposit is normally non-refundable once custom design work, artwork preparation, admin review or setup work has started, because it contributes towards time and costs already incurred. If JA Profile Studio cancels the work or cannot provide the agreed design service, the customer will be refunded any amount they are legally entitled to receive. This does not affect the customer's statutory rights.</p>
        <p className="text-xs font-medium">Paid custom design work will only begin once the deposit or agreed fee has been paid, unless JA Group Services Ltd agrees otherwise in writing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Your Name</Label>
          <Input value={form.name_on_card} onChange={e => set('name_on_card', e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input value={form.email_on_card} onChange={e => set('email_on_card', e.target.value)} placeholder="your@email.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Business Name</Label>
          <Input value={form.business_name_on_card} onChange={e => set('business_name_on_card', e.target.value)} placeholder="Company / business name" />
        </div>
        <div className="space-y-1.5">
          <Label>Role / Job Title</Label>
          <Input value={form.role_on_card} onChange={e => set('role_on_card', e.target.value)} placeholder="e.g. Director" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone Number</Label>
          <Input value={form.phone_on_card} onChange={e => set('phone_on_card', e.target.value)} placeholder="+44 7700 000000" />
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input value={form.website_on_card} onChange={e => set('website_on_card', e.target.value)} placeholder="www.example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline (optional)</Label>
          <Input value={form.tagline_on_card} onChange={e => set('tagline_on_card', e.target.value)} placeholder="Short tagline or strapline" />
        </div>
        <div className="space-y-1.5">
          <Label>Address (optional)</Label>
          <Input value={form.address_on_card} onChange={e => set('address_on_card', e.target.value)} placeholder="Business address" />
        </div>
        <div className="space-y-1.5">
          <Label>Brand Colours (optional)</Label>
          <Input value={form.brand_colors} onChange={e => set('brand_colors', e.target.value)} placeholder="e.g. Navy blue #1e3a5f, Gold #c8a96e" />
        </div>
        <div className="space-y-1.5">
          <Label>Style Preference (optional)</Label>
          <Select value={form.style_preference} onValueChange={v => set('style_preference', v)}>
            <SelectTrigger><SelectValue placeholder="Choose a style…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Minimal / Clean</SelectItem>
              <SelectItem value="bold">Bold / Modern</SelectItem>
              <SelectItem value="corporate">Corporate / Professional</SelectItem>
              <SelectItem value="premium">Premium / Luxury</SelectItem>
              <SelectItem value="creative">Creative / Artistic</SelectItem>
              <SelectItem value="no_preference">No preference — admin decides</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sides</Label>
          <Select value={form.front_back_preference} onValueChange={v => set('front_back_preference', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="double">Double-sided</SelectItem>
              <SelectItem value="single">Single-sided</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Quantity</Label>
          <Select value={form.quantity} onValueChange={v => set('quantity', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['25', '50', '100', '250', '500', '1000'].map(q => <SelectItem key={q} value={q}>{q} cards</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Card Size</Label>
          <Select value={form.card_size} onValueChange={v => set('card_size', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="85x55">Standard (85 × 55mm)</SelectItem>
              <SelectItem value="65x65">Square (65 × 65mm)</SelectItem>
              <SelectItem value="85x40">Slim (85 × 40mm)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Finish</Label>
          <Select value={form.finish} onValueChange={v => set('finish', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="matte">Matte</SelectItem>
              <SelectItem value="gloss">Glossy</SelectItem>
              <SelectItem value="uncoated">Uncoated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Corner Type</Label>
          <Select value={form.corner_type} onValueChange={v => set('corner_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Square Corners</SelectItem>
              <SelectItem value="rounded">Rounded Corners</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.qr_required} onChange={e => set('qr_required', e.target.checked)} className="rounded" />
            <QrCode className="w-4 h-4" />
            Include JA Profile Studio QR code
          </label>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notes for Admin</Label>
          <Textarea value={form.customer_notes} onChange={e => set('customer_notes', e.target.value)}
            placeholder="Describe your requirements, logo details, any existing branding, or anything else admin should know…" rows={4} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400 space-y-1">
        <p className="font-semibold">Payment</p>
        <p>Only pay using an official Stripe invoice or Stripe payment link issued by JA Profile Studio / JA Group Services Ltd. Payment links may be sent by Stripe email or placed inside your JA Profile Studio portal.</p>
        <p>No printing, provider order, final file release or paid custom design work will begin until payment has been received, unless JA Group Services Ltd agrees otherwise in writing.</p>
        <p>Prices shown or quoted do not include VAT unless VAT is expressly shown. JA Group Services Ltd is not currently VAT registered.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={form.confirmed} onChange={e => set('confirmed', e.target.checked)} className="mt-0.5 rounded" />
        <span className="text-sm">I understand that a design setup deposit from £15 upfront is required before custom design work begins, and that this deposit is normally non-refundable once work has started. This does not affect my statutory rights.</span>
      </label>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button disabled={!form.confirmed || !form.name_on_card || !form.email_on_card}
          onClick={() => onSubmit({ ...form, request_type: 'custom_design', quantity: Number(form.quantity), qr_required: form.qr_required ? 1 : 0 })}
          className="gap-2">
          <Send className="w-4 h-4" />Submit Design Request
        </Button>
      </div>
    </div>
  );
}

// ─── Order Detail / Messages ──────────────────────────────────────────────────

function OrderDetail({ order, onBack, onApprove }: { order: Order; onBack: () => void; onApprove: (id: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/business-cards/${order.id}/messages`)
      .then(r => r.json()).then(d => setMessages(d.messages || []));
  }, [order.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`/api/business-cards/${order.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg }),
      });
      if (r.ok) {
        const d = await r.json();
        setMessages(prev => [...prev, d.message]);
        setNewMsg('');
      }
    } finally { setSending(false); }
  };

  const handleApprove = async () => {
    if (!approvalConfirmed) return;
    setApproving(true);
    try {
      const r = await fetch(`/api/business-cards/${order.id}/approve`, { method: 'POST' });
      if (r.ok) onApprove(order.id);
    } finally { setApproving(false); }
  };

  const requestType = order.request_type === 'upload_own' ? 'Upload Own Design'
    : order.request_type === 'custom_design' ? 'Custom Design Request'
    : 'Business Card Builder';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <div>
          <h3 className="font-semibold">Request #{order.id} — {requestType}</h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={order.status} />
            <span className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="p-3 rounded-lg bg-muted/40 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Quantity</div>
          <div className="font-medium">{order.quantity} cards</div>
        </div>
        {order.total_quoted > 0 && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Quoted Price</div>
            <div className="font-medium">£{Number(order.total_quoted).toFixed(2)}</div>
          </div>
        )}
        {order.design_deposit_amount > 0 && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Design Deposit</div>
            <div className="font-medium">£{Number(order.design_deposit_amount).toFixed(2)} {order.design_deposit_paid ? '✓ Paid' : '— Required'}</div>
          </div>
        )}
      </div>

      {/* Payment link */}
      {(order.stripe_payment_link || order.stripe_invoice_url) && order.stripe_payment_status !== 'paid' && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2">
          <div className="font-semibold text-green-800 text-sm flex items-center gap-2"><Send className="w-4 h-4" />Payment Link Available</div>
          <p className="text-xs text-green-700">Only pay using an official Stripe invoice or Stripe payment link issued by JA Profile Studio / JA Group Services Ltd.</p>
          {order.stripe_invoice_url && (
            <a href={order.stripe_invoice_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-2"><FileText className="w-4 h-4" />View Stripe Invoice</Button>
            </a>
          )}
          {order.stripe_payment_link && !order.stripe_invoice_url && (
            <a href={order.stripe_payment_link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-2"><Send className="w-4 h-4" />Pay Now</Button>
            </a>
          )}
        </div>
      )}

      {/* Proof approval */}
      {order.status === 'awaiting_customer_approval' && order.proof_url && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
          <div className="font-semibold text-blue-800 text-sm flex items-center gap-2"><Eye className="w-4 h-4" />Proof Ready for Approval</div>
          <p className="text-xs text-blue-700">Please review your proof carefully before approving. Once approved and sent to print, changes may not be possible.</p>
          <a href={order.proof_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2"><Eye className="w-4 h-4" />View Proof</Button>
          </a>
          <div className="pt-2 border-t border-blue-200 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-blue-800">
              <input type="checkbox" checked={approvalConfirmed} onChange={e => setApprovalConfirmed(e.target.checked)} className="mt-0.5 rounded" />
              I confirm that I have checked and approved the final business card design, including spelling, contact details, QR code, logo, colours, layout, card size, finish and quantity.
            </label>
            <Button size="sm" disabled={!approvalConfirmed || approving} onClick={handleApprove} className="gap-2">
              <CheckCircle className="w-4 h-4" />{approving ? 'Approving…' : 'Approve Design'}
            </Button>
          </div>
        </div>
      )}

      {/* Final file */}
      {order.final_file_enabled === 1 && order.final_file_url && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
          <div className="font-semibold text-emerald-800 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Final File Available</div>
          <p className="text-xs text-emerald-700">Your final approved file is now available to download.</p>
          <a href={order.final_file_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Download className="w-4 h-4" />Download Final File</Button>
          </a>
        </div>
      )}

      {/* Proof only — locked */}
      {!order.final_file_enabled && order.proof_url && order.status !== 'awaiting_customer_approval' && (
        <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-3 text-sm">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Proof Available — Review Only</div>
            <div className="text-xs text-muted-foreground">Final files and printing are locked until admin review, payment and approval.</div>
          </div>
          <a href={order.proof_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1"><Eye className="w-3 h-3" />View Proof</Button>
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" />Messages</h4>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Admin will be in touch after reviewing your request.</p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${m.sender_type === 'customer' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                  <div className="text-xs opacity-70 mb-1">{m.sender_name}</div>
                  <div>{m.message}</div>
                  <div className="text-xs opacity-50 mt-1">{fmtTime(m.created_at)}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <Input value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message to admin…" className="text-sm" />
            <Button size="sm" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Design communication, proof review, payment links and order updates will happen through your JA Profile Studio portal.</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = 'landing' | 'upload' | 'custom' | 'orders' | 'order-detail';

export default function BusinessCardsPage() {
  const [view, setView] = useState<View>('landing');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [_submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/business-cards/feature-flag').then(r => r.json()).then(d => setEnabled(d.enabled));
    fetch('/api/business-cards').then(r => r.json()).then(d => setOrders(d.orders || []));
  }, []);

  const submitOrder = async (data: any) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await fetch('/api/business-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to submit');
      setOrders(prev => [d.order, ...prev]);
      setSubmitSuccess(true);
      setView('orders');
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (orderId: number) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'approved_for_print', customer_approved: 1 } : o));
    if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, status: 'approved_for_print', customer_approved: 1 } : prev);
  };

  if (!enabled) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <CreditCard className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Business Cards — Coming Soon</h2>
        <p className="text-muted-foreground">Business Cards are not currently available. Please check back soon or contact support.</p>
        <Link to="/dashboard/help-centre"><Button variant="outline">Help Centre</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <Helmet>
        <title>Business Cards — JA Profile Studio</title>
        <meta name="description" content="Create, upload or request business cards for your JA Profile Studio." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/business-cards" />
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Business Cards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create, upload or request business cards for your JA Profile Studio</p>
        </div>
        {orders.length > 0 && view === 'landing' && (
          <Button variant="outline" size="sm" onClick={() => setView('orders')}>
            My Requests <Badge className="ml-2">{orders.length}</Badge>
          </Button>
        )}
        {view !== 'landing' && view !== 'orders' && view !== 'order-detail' && (
          <Button variant="ghost" size="sm" onClick={() => setView('landing')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        )}
        {(view === 'orders' || view === 'order-detail') && (
          <Button variant="ghost" size="sm" onClick={() => setView('landing')}><ArrowLeft className="w-4 h-4 mr-1" />Back to Options</Button>
        )}
      </div>

      {submitSuccess && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 text-green-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Request submitted successfully</div>
            <div className="text-xs mt-0.5">Admin will review your request and be in touch through your portal. No payment is required yet.</div>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="ml-auto text-green-600 hover:text-green-800">✕</button>
        </motion.div>
      )}

      {submitError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{submitError}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Landing — 2 option cards (no builder) */}
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Choose how you want to create your business cards. Upload your own print-ready artwork, or ask the JA Profile Studio team to create a custom design for you. We review every request, confirm the price, and send an official Stripe invoice or payment link before any printing, design work, or file release begins.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              {/* Option 1 — Upload Own */}
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <Card className="h-full border-2 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setView('upload')}>
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                      <Upload className="w-6 h-6 text-blue-500" />
                    </div>
                    <CardTitle className="text-lg">Upload Your Own Design</CardTitle>
                    <CardDescription className="text-sm">Already have a business card design? Upload your print-ready artwork and we will review it, confirm the price, and arrange printing.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />PDF, AI, EPS, PNG (300dpi+) accepted</div>
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Front and back design files</div>
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Admin artwork review included</div>
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Price confirmed before payment</div>
                    </div>
                    <Button variant="outline" className="w-full gap-2">Upload Design <ChevronRight className="w-4 h-4" /></Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Option 2 — Custom Design */}
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <Card className="h-full border-2 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setView('custom')}>
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <Paintbrush className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Request Custom Design</CardTitle>
                    <CardDescription className="text-sm">Need us to create the design for you? Our team will design your business card using your details, logo, brand colours, and QR code. A design deposit is required upfront.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Team creates your design</div>
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Proof sent for your approval</div>
                      <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" />Revisions included</div>
                      <div className="flex items-center gap-1.5"><Info className="w-3 h-3 text-blue-400" />Design deposit required upfront</div>
                    </div>
                    <Button variant="outline" className="w-full gap-2">Request Design <ChevronRight className="w-4 h-4" /></Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Legal notices */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2 max-w-2xl">
              <p><strong>Pricing:</strong> Business Cards are a paid add-on service. Printed cards, provider costs, delivery, premium finishes, custom design, and related services are charged separately.</p>
              <p><strong>Payment:</strong> Only pay using an official Stripe invoice or Stripe payment link issued by JA Profile Studio / JA Group Services Ltd. No printing, provider order, final file release, or paid design work begins until payment is received.</p>
            </div>

            {/* My requests */}
            {orders.length > 0 && (
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">My Requests</h3>
                  <Button variant="ghost" size="sm" onClick={() => setView('orders')}>View all</Button>
                </div>
                <div className="space-y-2">
                  {orders.slice(0, 3).map(o => (
                    <button key={o.id} onClick={() => { setSelectedOrder(o); setView('order-detail'); }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Request #{o.id} — {o.request_type === 'upload_own' ? 'Upload Own Design' : 'Custom Design'}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div>
                        </div>
                      </div>
                      <StatusBadge status={o.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Upload */}
        {view === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Upload Your Own Design</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadDesignForm onSubmit={submitOrder} onBack={() => setView('landing')} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Custom Design */}
        {view === 'custom' && (
          <motion.div key="custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Paintbrush className="w-5 h-5" />Request Custom Design</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomDesignForm onSubmit={submitOrder} onBack={() => setView('landing')} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Orders list */}
        {view === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <h3 className="font-semibold">My Business Card Requests</h3>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No requests yet. Choose an option above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(o => (
                  <button key={o.id} onClick={() => { setSelectedOrder(o); setView('order-detail'); }}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/40 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="font-medium text-sm">Request #{o.id} — {o.request_type === 'upload_own' ? 'Upload Own Design' : o.request_type === 'custom_design' ? 'Custom Design Request' : 'Business Card Builder'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{o.quantity} cards · {fmtDate(o.created_at)}</div>
                          {o.total_quoted > 0 && <div className="text-xs text-muted-foreground">Quoted: £{Number(o.total_quoted).toFixed(2)}</div>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Order detail */}
        {view === 'order-detail' && selectedOrder && (
          <motion.div key="order-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="pt-6">
                <OrderDetail
                  order={selectedOrder}
                  onBack={() => setView('orders')}
                  onApprove={handleApprove}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
