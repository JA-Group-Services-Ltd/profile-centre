/**
 * Admin — Business Cards Hub
 *
 * Four sections:
 *   Orders       — all card orders, status management, pricing, proof, dispatch
 *   POS          — point-of-sale: create orders on behalf of customers
 *   Settings     — pricing defaults, turnaround, accepted file types, messaging templates
 *   Communications — bulk/individual messaging to customers with active orders
 *
 * No builder. Customers either upload their own print-ready artwork or request
 * a custom design from the team.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  CreditCard, Search, RefreshCw, Loader2, CheckCircle2, Upload, Eye,
  User, Send, Settings, Plus, Edit, DollarSign, Receipt, ExternalLink,
  MessageSquare, Package, Truck, AlertCircle, Clock, X, Check,
  LayoutGrid, ShoppingCart, Wrench, Mail, ChevronDown, ChevronUp,
  FileText, Info, Printer, Hash, Phone,
} from 'lucide-react';import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ── Status definitions ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted:                      { label: 'Submitted',                      color: 'bg-blue-100 text-blue-700 border border-blue-200' },
  awaiting_admin_review:          { label: 'Awaiting Review',                color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  file_review_required:           { label: 'File Review Required',           color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  artwork_not_print_ready:        { label: 'Artwork Not Print-Ready',        color: 'bg-red-100 text-red-700 border border-red-200' },
  artwork_approved_for_proof:     { label: 'Artwork Approved',               color: 'bg-green-100 text-green-700 border border-green-200' },
  proof_generated:                { label: 'Proof Generated',                color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  proof_sent:                     { label: 'Proof Sent',                     color: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  proof_approved:                 { label: 'Proof Approved',                 color: 'bg-green-100 text-green-700 border border-green-200' },
  changes_requested:              { label: 'Changes Requested',              color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  design_deposit_required:        { label: 'Design Deposit Required',        color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  design_deposit_invoice_sent:    { label: 'Deposit Invoice Sent',           color: 'bg-purple-100 text-purple-700 border border-purple-200' },
  custom_design_fee_required:     { label: 'Custom Design Fee Required',     color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  design_fee_quoted:              { label: 'Design Fee Quoted',              color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  provider_price_required:        { label: 'Provider Price Required',        color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  print_price_quoted:             { label: 'Print Price Quoted',             color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  stripe_invoice_required:        { label: 'Invoice Required',               color: 'bg-purple-100 text-purple-700 border border-purple-200' },
  stripe_invoice_sent:            { label: 'Invoice Sent',                   color: 'bg-purple-100 text-purple-800 border border-purple-300' },
  stripe_payment_link_required:   { label: 'Payment Link Required',          color: 'bg-purple-100 text-purple-700 border border-purple-200' },
  payment_link_sent:              { label: 'Payment Link Sent',              color: 'bg-purple-100 text-purple-800 border border-purple-300' },
  awaiting_payment:               { label: 'Awaiting Payment',               color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  paid_design_can_start:          { label: 'Paid — Design Can Start',        color: 'bg-green-100 text-green-700 border border-green-200' },
  design_work_can_start:          { label: 'Design Work Can Start',          color: 'bg-teal-100 text-teal-700 border border-teal-200' },
  final_file_enabled:             { label: 'Final File Enabled',             color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  ready_for_print:                { label: 'Ready for Print',                color: 'bg-teal-100 text-teal-700 border border-teal-200' },
  ordered_with_provider:          { label: 'Ordered with Provider',          color: 'bg-teal-100 text-teal-800 border border-teal-200' },
  in_production:                  { label: 'In Production',                  color: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  dispatched:                     { label: 'Dispatched',                     color: 'bg-teal-100 text-teal-800 border border-teal-200' },
  completed:                      { label: 'Completed',                      color: 'bg-green-100 text-green-800 border border-green-300' },
  cancelled:                      { label: 'Cancelled',                      color: 'bg-red-100 text-red-700 border border-red-200' },
  rejected:                       { label: 'Rejected',                       color: 'bg-red-100 text-red-800 border border-red-200' },
  refund_requested:               { label: 'Refund Requested',               color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  refunded:                       { label: 'Refunded',                       color: 'bg-gray-100 text-gray-700 border border-gray-200' },
  issue_reported:                 { label: 'Issue Reported',                 color: 'bg-red-100 text-red-700 border border-red-200' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700 border border-gray-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    upload_own:    { label: 'Upload Own',    color: 'bg-indigo-100 text-indigo-700' },
    custom_design: { label: 'Custom Design', color: 'bg-blue-500/10 text-blue-400' },
    pos:           { label: 'POS',           color: 'bg-amber-100 text-amber-700' },
  };
  const s = map[type] ?? { label: type, color: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

// ── Order Detail Panel ────────────────────────────────────────────────────────

function OrderDetailPanel({ order, onClose, onRefresh }: { order: any; onClose: () => void; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [tab, setTab] = useState('details');
  const [status, setStatus] = useState(order.status ?? 'submitted');
  const [internalNotes, setInternalNotes] = useState(order.internal_notes ?? '');
  const [proofUrl, setProofUrl] = useState(order.proof_url ?? '');
  const [finalFileUrl, setFinalFileUrl] = useState(order.final_file_url ?? '');
  const [finalFileEnabled, setFinalFileEnabled] = useState(order.final_file_enabled === 1);
  const [providerRef, setProviderRef] = useState(order.provider_ref ?? '');
  const [dispatchTracking, setDispatchTracking] = useState(order.dispatch_tracking ?? '');
  const [pricing, setPricing] = useState({
    provider_cost: order.provider_cost ?? 0,
    delivery_cost: order.delivery_cost ?? 0,
    artwork_prep_fee: order.artwork_prep_fee ?? 0,
    design_fee_amount: order.design_fee_amount ?? 0,
    handling_fee: order.handling_fee ?? 0,
    total_quoted: order.total_quoted ?? 0,
    provider: order.provider ?? '',
  });
  const [invoice, setInvoice] = useState({
    stripe_invoice_id: order.stripe_invoice_id ?? '',
    stripe_invoice_url: order.stripe_invoice_url ?? '',
    stripe_invoice_status: order.stripe_invoice_status ?? 'not_required',
    stripe_payment_link: order.stripe_payment_link ?? '',
    stripe_payment_notes: order.stripe_payment_notes ?? '',
  });

  useEffect(() => {
    fetch(`/api/admin/business-cards/${order.id}/messages`, { credentials: 'include' })
      .then(r => r.json()).then(d => setMessages(d.messages || []));
  }, [order.id]);

  const computedTotal = () =>
    Number(pricing.provider_cost) + Number(pricing.delivery_cost) +
    Number(pricing.artwork_prep_fee) + Number(pricing.design_fee_amount) +
    Number(pricing.handling_fee);

  const save = async (endpoint: string, body: object, label: string) => {
    setSaving(true); setMsg('');
    try {
      await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      setMsg(`${label} saved.`); onRefresh();
    } catch { setMsg(`Error saving ${label.toLowerCase()}.`); } finally { setSaving(false); }
  };

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    setSendingMsg(true);
    try {
      await fetch(`/api/admin/business-cards/${order.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ message: newMsg }),
      });
      setNewMsg('');
      const d = await fetch(`/api/admin/business-cards/${order.id}/messages`, { credentials: 'include' }).then(r => r.json());
      setMessages(d.messages || []);
    } finally { setSendingMsg(false); }
  };

  const toggleFinalFile = async () => {
    const next = !finalFileEnabled;
    setFinalFileEnabled(next);
    await fetch(`/api/admin/business-cards/${order.id}/final-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ enabled: next, final_file_url: finalFileUrl }),
    });
    onRefresh();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <CreditCard className="w-4 h-4 text-primary" />
            Order #{order.id}
            <StatusBadge status={order.status} />
            <TypeBadge type={order.request_type} />
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="invoice">Invoice</TabsTrigger>
            <TabsTrigger value="proof">Proof / File</TabsTrigger>
            <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Customer', order.user_name || order.user_email || `User #${order.user_id}`],
                ['Email', order.user_email],
                ['Name on Card', order.name_on_card],
                ['Business Name', order.business_name_on_card],
                ['Quantity', order.quantity],
                ['Size', order.card_size || '—'],
                ['Finish', order.finish || '—'],
                ['Submitted', fmtDate(order.created_at)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v || '—'}</span>
                </div>
              ))}
            </div>

            {order.customer_notes && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-sm">
                <p className="text-xs text-muted-foreground mb-1">Customer notes</p>
                <p className="text-foreground">{order.customer_notes}</p>
              </div>
            )}

            {order.artwork_url && (
              <div className="space-y-2">
                {/* Inline preview for image files */}
                {/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(order.artwork_url) ? (
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/30 max-h-64 flex items-center justify-center">
                    <img
                      src={order.artwork_url}
                      alt="Uploaded artwork"
                      className="max-h-64 max-w-full object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
                    Artwork file attached (non-image format — open link to view)
                  </div>
                )}
                <a href={order.artwork_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs">
                    <Upload className="w-3 h-3" /> Open Artwork File
                  </Button>
                </a>
              </div>
            )}

            {/* Link to edit customer's public profile */}
            <div className="flex items-center gap-2 pt-1">
              <a href={`/admin/profiles`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs">
                  <User className="w-3 h-3" /> Edit Customer's Public Profile
                </Button>
              </a>
              <a href={`/admin/users/${order.user_id}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs">
                  <ExternalLink className="w-3 h-3" /> Open CRM Record
                </Button>
              </a>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provider reference</Label>
                <Input value={providerRef} onChange={e => setProviderRef(e.target.value)} className="bg-background border-border text-sm" placeholder="Provider order ref" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dispatch tracking number</Label>
                <Input value={dispatchTracking} onChange={e => setDispatchTracking(e.target.value)} className="bg-background border-border text-sm" placeholder="Tracking number / URL" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Internal notes</Label>
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} className="bg-background border-border text-sm resize-none" rows={3} />
              </div>

              <Button size="sm" onClick={() => save(`/api/admin/business-cards/${order.id}`, { status, internal_notes: internalNotes, provider_ref: providerRef, dispatch_tracking: dispatchTracking }, 'Details')} disabled={saving} className="bg-primary gap-1.5">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save Details
              </Button>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
            </div>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { key: 'provider_cost', label: 'Provider cost (£)' },
                { key: 'delivery_cost', label: 'Delivery cost (£)' },
                { key: 'artwork_prep_fee', label: 'Artwork prep fee (£)' },
                { key: 'design_fee_amount', label: 'Design fee (£)' },
                { key: 'handling_fee', label: 'Handling fee (£)' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input type="number" step="0.01" min="0"
                    value={(pricing as any)[key]}
                    onChange={e => setPricing(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                    className="bg-background border-border text-sm" />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Print provider</Label>
                <Input value={pricing.provider} onChange={e => setPricing(p => ({ ...p, provider: e.target.value }))} className="bg-background border-border text-sm" placeholder="e.g. Moo, Vistaprint" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Computed total</span>
              <span className="text-lg font-bold text-foreground">£{computedTotal().toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Override total quoted (£) — leave 0 to use computed</Label>
              <Input type="number" step="0.01" min="0" value={pricing.total_quoted}
                onChange={e => setPricing(p => ({ ...p, total_quoted: parseFloat(e.target.value) || 0 }))}
                className="bg-background border-border text-sm" />
            </div>

            <Button size="sm" onClick={() => save(`/api/admin/business-cards/${order.id}/quote-price`, { ...pricing, total_quoted: pricing.total_quoted > 0 ? pricing.total_quoted : computedTotal() }, 'Pricing')} disabled={saving} className="bg-primary gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} Save Pricing
            </Button>
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </TabsContent>

          {/* Invoice */}
          <TabsContent value="invoice" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stripe Invoice ID</Label>
                <Input value={invoice.stripe_invoice_id} onChange={e => setInvoice(v => ({ ...v, stripe_invoice_id: e.target.value }))} className="bg-background border-border text-sm" placeholder="in_..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Invoice URL</Label>
                <Input value={invoice.stripe_invoice_url} onChange={e => setInvoice(v => ({ ...v, stripe_invoice_url: e.target.value }))} className="bg-background border-border text-sm" placeholder="https://invoice.stripe.com/..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Invoice status</Label>
                <Select value={invoice.stripe_invoice_status} onValueChange={v => setInvoice(i => ({ ...i, stripe_invoice_status: v }))}>
                  <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['not_required','draft','open','paid','void','uncollectible'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Payment link</Label>
                <Input value={invoice.stripe_payment_link} onChange={e => setInvoice(v => ({ ...v, stripe_payment_link: e.target.value }))} className="bg-background border-border text-sm" placeholder="https://buy.stripe.com/..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment notes</Label>
              <Textarea value={invoice.stripe_payment_notes} onChange={e => setInvoice(v => ({ ...v, stripe_payment_notes: e.target.value }))} className="bg-background border-border text-sm resize-none" rows={2} />
            </div>
            <Button size="sm" onClick={() => save(`/api/admin/business-cards/${order.id}`, invoice, 'Invoice')} disabled={saving} className="bg-primary gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />} Save Invoice Details
            </Button>
            {invoice.stripe_invoice_url && (
              <a href={invoice.stripe_invoice_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs ml-2">
                  <ExternalLink className="w-3 h-3" /> Open Invoice
                </Button>
              </a>
            )}
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </TabsContent>

          {/* Proof / File */}
          <TabsContent value="proof" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Proof URL (send to customer for approval)</Label>
              <Input value={proofUrl} onChange={e => setProofUrl(e.target.value)} className="bg-background border-border text-sm" placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Final file URL (customer download)</Label>
              <Input value={finalFileUrl} onChange={e => setFinalFileUrl(e.target.value)} className="bg-background border-border text-sm" placeholder="https://..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={finalFileEnabled} onCheckedChange={toggleFinalFile} />
              <Label className="text-sm">Enable final file download for customer</Label>
            </div>
            <Button size="sm" onClick={() => save(`/api/admin/business-cards/${order.id}`, { proof_url: proofUrl, final_file_url: finalFileUrl }, 'Proof')} disabled={saving} className="bg-primary gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save Proof / File
            </Button>
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex gap-2 ${m.sender_type === 'admin' ? 'flex-row-reverse' : ''}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                    m.sender_type === 'admin'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    <p className="text-xs opacity-70 mb-0.5">{m.sender_name} · {fmtDate(m.created_at)}</p>
                    <p>{m.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message to the customer…" className="bg-background border-border text-sm resize-none" rows={2} />
              <Button onClick={sendMessage} disabled={sendingMsg || !newMsg.trim()} className="bg-primary self-end gap-1.5">
                {sendingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── POS — Create order on behalf of customer ──────────────────────────────────

function POSPanel({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    user_email: '',
    name_on_card: '',
    business_name_on_card: '',
    phone_on_card: '',
    email_on_card: '',
    website_on_card: '',
    quantity: 250,
    card_size: '85x55mm',
    finish: 'gloss',
    corner_type: 'rounded',
    request_type: 'upload_own',
    customer_notes: '',
    artwork_url: '',
    internal_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const setF = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.user_email || !form.name_on_card) {
      setMsg('Customer email and name on card are required.');
      return;
    }
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/admin/business-cards/pos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.success) {
        setSuccess(true);
        setForm(f => ({ ...f, user_email: '', name_on_card: '', business_name_on_card: '', customer_notes: '', artwork_url: '', internal_notes: '' }));
        onCreated();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setMsg(d.error || 'Failed to create order');
      }
    } catch { setMsg('Error creating order'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" /> Create Order (POS)
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Create a business card order on behalf of a customer. No builder — customer must supply artwork or request custom design.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Order created successfully.
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Customer email <span className="text-red-400">*</span></Label>
            <Input value={form.user_email} onChange={e => setF('user_email', e.target.value)} className="bg-background border-border text-sm" placeholder="customer@example.com" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /> Card Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name on card <span className="text-red-400">*</span></Label>
              <Input value={form.name_on_card} onChange={e => setF('name_on_card', e.target.value)} className="bg-background border-border text-sm" placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business name</Label>
              <Input value={form.business_name_on_card} onChange={e => setF('business_name_on_card', e.target.value)} className="bg-background border-border text-sm" placeholder="Acme Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={form.phone_on_card} onChange={e => setF('phone_on_card', e.target.value)} className="bg-background border-border text-sm" placeholder="+44 7700 000000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email on card</Label>
              <Input value={form.email_on_card} onChange={e => setF('email_on_card', e.target.value)} className="bg-background border-border text-sm" placeholder="jane@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input value={form.website_on_card} onChange={e => setF('website_on_card', e.target.value)} className="bg-background border-border text-sm" placeholder="https://acme.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Printer className="w-4 h-4 text-muted-foreground" /> Print Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity</Label>
              <Select value={String(form.quantity)} onValueChange={v => setF('quantity', parseInt(v))}>
                <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[50, 100, 250, 500, 1000].map(q => <SelectItem key={q} value={String(q)}>{q} cards</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Card size</Label>
              <Select value={form.card_size} onValueChange={v => setF('card_size', v)}>
                <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="85x55mm">Standard 85 × 55mm</SelectItem>
                  <SelectItem value="90x50mm">Slim 90 × 50mm</SelectItem>
                  <SelectItem value="square_65mm">Square 65 × 65mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <Select value={form.finish} onValueChange={v => setF('finish', v)}>
                <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gloss">Gloss</SelectItem>
                  <SelectItem value="matte">Matte</SelectItem>
                  <SelectItem value="soft_touch">Soft Touch</SelectItem>
                  <SelectItem value="uncoated">Uncoated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Corners</Label>
              <Select value={form.corner_type} onValueChange={v => setF('corner_type', v)}>
                <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Order type</Label>
              <Select value={form.request_type} onValueChange={v => setF('request_type', v)}>
                <SelectTrigger className="bg-background border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload_own">Customer uploads artwork</SelectItem>
                  <SelectItem value="custom_design">Custom design by team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Artwork URL (if already supplied)</Label>
            <Input value={form.artwork_url} onChange={e => setF('artwork_url', e.target.value)} className="bg-background border-border text-sm" placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Customer notes (visible to customer)</Label>
            <Textarea value={form.customer_notes} onChange={e => setF('customer_notes', e.target.value)} className="bg-background border-border text-sm resize-none" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Internal notes (admin only)</Label>
            <Textarea value={form.internal_notes} onChange={e => setF('internal_notes', e.target.value)} className="bg-background border-border text-sm resize-none" rows={2} />
          </div>
        </CardContent>
      </Card>

      {msg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {msg}
        </div>
      )}

      <Button onClick={submit} disabled={saving} className="bg-primary gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {saving ? 'Creating…' : 'Create Order'}
      </Button>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel() {
  const [settings, setSettings] = useState({
    bc_turnaround_days: '5',
    bc_accepted_formats: 'PDF, AI, EPS, PNG (300dpi+)',
    bc_min_dpi: '300',
    bc_bleed_mm: '3',
    bc_custom_design_fee: '50',
    bc_design_deposit_pct: '50',
    bc_default_provider: '',
    bc_upload_instructions: 'Please supply print-ready artwork at 300dpi minimum with 3mm bleed on all sides. Accepted formats: PDF, AI, EPS, PNG.',
    bc_custom_design_brief: 'Please describe your design requirements, brand colours, logo placement, and any text you want included.',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Feature flag
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [featureToggling, setFeatureToggling] = useState(false);
  const [featureMsg, setFeatureMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings/business-cards', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setSettings(s => ({ ...s, ...d.data })); })
      .catch(() => {});
    fetch('/api/business-cards/feature-flag', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setFeatureEnabled(!!d.enabled))
      .catch(() => setFeatureEnabled(false));
  }, []);

  const toggleFeature = async () => {
    if (featureEnabled === null) return;
    setFeatureToggling(true); setFeatureMsg('');
    try {
      const res = await fetch('/api/admin/business-cards/feature-flag', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ enabled: !featureEnabled }),
      });
      const d = await res.json();
      setFeatureEnabled(!!d.enabled);
      setFeatureMsg(`Business Cards feature ${d.enabled ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setFeatureMsg(''), 4000);
    } catch { setFeatureMsg('Error toggling feature.'); } finally { setFeatureToggling(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings/business-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(settings),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const setF = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" /> Business Cards Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure defaults, pricing, and instructions shown to customers.
        </p>
      </div>

      {/* ── Feature flag ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" /> Feature Availability
          </CardTitle>
          <CardDescription className="text-xs">
            Controls whether the Business Cards section is visible and accessible to customers.
            When disabled, customers cannot view, submit, or manage orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Business Cards feature</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {featureEnabled === null
                  ? 'Loading…'
                  : featureEnabled
                    ? 'Currently enabled — customers can access Business Cards'
                    : 'Currently disabled — Business Cards are hidden from customers'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {featureEnabled !== null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  featureEnabled
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {featureEnabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
              <Switch
                checked={!!featureEnabled}
                onCheckedChange={toggleFeature}
                disabled={featureToggling || featureEnabled === null}
              />
            </div>
          </div>
          {featureMsg && (
            <p className="text-xs text-muted-foreground mt-2">{featureMsg}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Print Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { key: 'bc_turnaround_days', label: 'Standard turnaround (days)', placeholder: '5' },
              { key: 'bc_min_dpi', label: 'Minimum DPI required', placeholder: '300' },
              { key: 'bc_bleed_mm', label: 'Bleed required (mm)', placeholder: '3' },
              { key: 'bc_default_provider', label: 'Default print provider', placeholder: 'e.g. Moo' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input value={(settings as any)[key]} onChange={e => setF(key, e.target.value)} className="bg-background border-border text-sm" placeholder={placeholder} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Accepted file formats</Label>
              <Input value={settings.bc_accepted_formats} onChange={e => setF('bc_accepted_formats', e.target.value)} className="bg-background border-border text-sm" placeholder="PDF, AI, EPS, PNG" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pricing Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Custom design fee (£)</Label>
              <Input type="number" value={settings.bc_custom_design_fee} onChange={e => setF('bc_custom_design_fee', e.target.value)} className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Design deposit (%)</Label>
              <Input type="number" value={settings.bc_design_deposit_pct} onChange={e => setF('bc_design_deposit_pct', e.target.value)} className="bg-background border-border text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Customer Instructions</CardTitle>
          <CardDescription className="text-xs">Shown to customers when they place an order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Upload own artwork instructions</Label>
            <Textarea value={settings.bc_upload_instructions} onChange={e => setF('bc_upload_instructions', e.target.value)} className="bg-background border-border text-sm resize-none" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Custom design brief prompt</Label>
            <Textarea value={settings.bc_custom_design_brief} onChange={e => setF('bc_custom_design_brief', e.target.value)} className="bg-background border-border text-sm resize-none" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-primary gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}

// ── Communications Panel ──────────────────────────────────────────────────────

function CommunicationsPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    fetch('/api/admin/business-cards?limit=200', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const ACTIVE_STATUSES = ['submitted','awaiting_admin_review','file_review_required','awaiting_payment','payment_link_sent','design_work_can_start','proof_sent','in_production','dispatched'];
  const filtered = filter === 'active'
    ? orders.filter(o => ACTIVE_STATUSES.includes(o.status))
    : orders;

  const toggleSelect = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const selectAll = () => setSelected(filtered.map(o => o.id));
  const clearAll = () => setSelected([]);

  const sendBulk = async () => {
    if (!message.trim() || selected.length === 0) return;
    setSending(true);
    try {
      await Promise.all(selected.map(id =>
        fetch(`/api/admin/business-cards/${id}/messages`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ message }),
        })
      ));
      setSent(true); setMessage(''); setSelected([]);
      setTimeout(() => setSent(false), 4000);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Communications
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send messages to customers with active or recent business card orders.
        </p>
      </div>

      {sent && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Messages sent to {selected.length === 0 ? 'selected customers' : `${selected.length} customer${selected.length !== 1 ? 's' : ''}`}.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Order list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {['active', 'all'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors capitalize ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {f === 'active' ? 'Active orders' : 'All orders'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
              <span className="text-muted-foreground text-xs">·</span>
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filtered.map(o => (
                <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selected.includes(o.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
                }`}>
                  <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="sr-only" />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected.includes(o.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                  }`}>
                    {selected.includes(o.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{o.user_name || o.user_email || `User #${o.user_id}`}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <StatusBadge status={o.status} />
                      <span className="text-xs text-muted-foreground">#{o.id}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{selected.length} selected</p>
        </div>

        {/* Message composer */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Message</Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message to the selected customers…"
            className="bg-background border-border text-sm resize-none"
            rows={8}
          />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Quick templates:</p>
            {[
              { label: 'Proof ready', text: 'Your business card proof is ready for review. Please check your order and approve or request changes.' },
              { label: 'Dispatched', text: 'Great news — your business cards have been dispatched! You should receive them within 2–3 working days.' },
              { label: 'Artwork needed', text: 'We need your print-ready artwork to proceed with your order. Please upload your file or reply to this message.' },
            ].map(t => (
              <button key={t.label} onClick={() => setMessage(t.text)}
                className="text-xs text-primary hover:underline block">{t.label}</button>
            ))}
          </div>
          <Button onClick={sendBulk} disabled={sending || !message.trim() || selected.length === 0} className="bg-primary gap-2 w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : `Send to ${selected.length} customer${selected.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/business-cards?limit=200', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || (o.user_name || '').toLowerCase().includes(q) || (o.user_email || '').toLowerCase().includes(q) || String(o.id).includes(q) || (o.name_on_card || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchType = typeFilter === 'all' || o.request_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Stats
  const stats = {
    total: orders.length,
    active: orders.filter(o => !['completed','cancelled','rejected','refunded'].includes(o.status)).length,
    awaiting: orders.filter(o => ['awaiting_payment','awaiting_admin_review','file_review_required'].includes(o.status)).length,
    dispatched: orders.filter(o => o.status === 'dispatched').length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total orders', value: stats.total, icon: Hash },
          { label: 'Active', value: stats.active, icon: Clock },
          { label: 'Awaiting action', value: stats.awaiting, icon: AlertCircle },
          { label: 'Dispatched', value: stats.dispatched, icon: Truck },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…" className="bg-background border-border text-sm pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-background border-border text-sm w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-background border-border text-sm w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="upload_own">Upload Own</SelectItem>
            <SelectItem value="custom_design">Custom Design</SelectItem>
            <SelectItem value="pos">POS</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <Card key={o.id} className="bg-card border-border hover:border-border/80 transition-colors cursor-pointer" onClick={() => setSelected(o)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground">{o.user_name || o.user_email || `User #${o.user_id}`}</p>
                      <StatusBadge status={o.status} />
                      <TypeBadge type={o.request_type} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>#{o.id}</span>
                      <span>{o.name_on_card || '—'}</span>
                      {o.quantity && <span>{o.quantity} cards</span>}
                      {o.total_quoted > 0 && <span>£{Number(o.total_quoted).toFixed(2)}</span>}
                      <span>{fmtDate(o.created_at)}</span>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <OrderDetailPanel order={selected} onClose={() => setSelected(null)} onRefresh={load} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminBusinessCards() {
  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Business Cards — Admin</title>
        <meta name="description" content="Manage business card orders, POS, settings, and customer communications." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/business-cards" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" /> Business Cards
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage all business card orders, POS, settings, and customer communications. No auto-builder — customers attach their own artwork or request a custom design.
        </p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="bg-muted/50 border border-border mb-6">
          <TabsTrigger value="orders" className="gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" /> Orders
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> POS
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Communications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="pos"><POSPanel onCreated={() => {}} /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
        <TabsContent value="communications"><CommunicationsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
