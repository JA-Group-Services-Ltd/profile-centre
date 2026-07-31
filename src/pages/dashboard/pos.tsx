/**
 * Dashboard — Point of Sale (POS)
 * /dashboard/pos
 *
 * Lets a user create a custom Stripe Checkout payment link for any amount
 * and description. Stripe handles card collection and confirmation.
 * Transaction history is shown below the form.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Loader2, CheckCircle2, AlertCircle, ExternalLink,
  RefreshCw, Clock, Receipt, Info, PoundSterling, FileText, User, Mail, Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { fmtDateTime } from '@/lib/date';

interface PosTransaction {
  id: number;
  stripe_session_id: string;
  amount_pence: number;
  description: string;
  customer_name: string | null;
  customer_email: string | null;
  reference: string | null;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  created_at: string;
}

function fmt(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: PosTransaction['status'] }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    paid:      'bg-green-500/10 text-green-400 border-green-500/20',
    expired:   'bg-muted text-muted-foreground border-border',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <Badge className={`text-xs border capitalize ${map[status] ?? map.pending}`}>
      {status}
    </Badge>
  );
}

export default function PosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentResult = searchParams.get('payment');

  // Form state
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [reference, setReference] = useState('');

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // History
  const [history, setHistory] = useState<PosTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = () => {
    setHistoryLoading(true);
    fetch('/api/pos/history', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setHistory(d.data); })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => { loadHistory(); }, []);

  // Clear payment result from URL after showing it
  useEffect(() => {
    if (paymentResult) {
      const t = setTimeout(() => {
        setSearchParams({}, { replace: true });
        loadHistory(); // refresh history after payment
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [paymentResult, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseFloat(amountStr.replace(/[£,]/g, '').trim());
    if (isNaN(parsed) || parsed < 0.50) {
      setError('Please enter a valid amount of at least £0.50.');
      return;
    }
    if (parsed > 999999) {
      setError('Amount cannot exceed £999,999.');
      return;
    }
    if (!description.trim() || description.trim().length < 3) {
      setError('Please enter a description (at least 3 characters).');
      return;
    }
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setError('Please enter a valid customer email address, or leave it blank.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/pos/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount_pence: Math.round(parsed * 100),
          description: description.trim(),
          customer_name: customerName.trim() || undefined,
          customer_email: customerEmail.trim() || undefined,
          reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        setError(data.error || 'Could not create payment link. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Point of Sale — Profile Centre</title>
        <meta name="description" content="Create a payment link for any amount. Stripe handles card collection securely." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/pos" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Point of Sale</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Create a secure Stripe payment link for any amount. Your customer pays via card — you get notified when it goes through.
          </p>
        </div>

        {/* Payment result banner */}
        {paymentResult === 'success' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Payment completed</p>
              <p className="text-xs text-green-400/80 mt-0.5">The payment was processed successfully by Stripe. Your transaction history will update shortly.</p>
            </div>
          </div>
        )}
        {paymentResult === 'cancelled' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Payment cancelled</p>
              <p className="text-xs text-amber-400/80 mt-0.5">The customer cancelled before completing payment. No charge was made.</p>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-400/90 space-y-1">
            <p className="font-semibold text-blue-400">How this works</p>
            <p>Fill in the amount and description below, then click <strong>Create Payment Link</strong>. You will be taken to a secure Stripe Checkout page where the customer enters their card details. Stripe handles all card processing — your card details are never stored here.</p>
          </div>
        </div>

        {/* Payment form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              New Payment
            </CardTitle>
            <CardDescription>Enter the payment details. Required fields are marked with *</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Amount + Description */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pos-amount" className="text-sm font-medium">
                    <span className="flex items-center gap-1.5"><PoundSterling className="w-3.5 h-3.5" /> Amount (GBP) *</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                    <Input
                      id="pos-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountStr}
                      onChange={e => setAmountStr(e.target.value)}
                      className="pl-7 bg-background border-border font-mono"
                      required
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum £0.50</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pos-desc" className="text-sm font-medium">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Description *</span>
                  </Label>
                  <Input
                    id="pos-desc"
                    type="text"
                    placeholder="e.g. Consultation fee, Invoice #123"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-background border-border"
                    maxLength={127}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">Shown on the Stripe payment page</p>
                </div>
              </div>

              <Separator />

              {/* Optional customer details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer details (optional)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pos-cname" className="text-sm font-medium">
                      <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer name</span>
                    </Label>
                    <Input
                      id="pos-cname"
                      type="text"
                      placeholder="e.g. Jane Smith"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="bg-background border-border"
                      maxLength={100}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pos-cemail" className="text-sm font-medium">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Customer email</span>
                    </Label>
                    <Input
                      id="pos-cemail"
                      type="email"
                      placeholder="e.g. jane@example.com"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      className="bg-background border-border"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">Pre-fills the email on the Stripe page</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pos-ref" className="text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Your reference</span>
                </Label>
                <Input
                  id="pos-ref"
                  type="text"
                  placeholder="e.g. INV-2026-001, Order #456"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="bg-background border-border"
                  maxLength={127}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">Stored with the transaction for your records — not shown to the customer</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-primary gap-2 text-primary-foreground"
                size="lg"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating payment link…</>
                ) : (
                  <><ExternalLink className="w-4 h-4" /> Create Payment Link</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                You will be redirected to Stripe Checkout. Card details are handled entirely by Stripe — they are never stored on this platform.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Transaction History
            </h2>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : history.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Payments you create will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map(tx => (
                <Card key={tx.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-foreground">{tx.description}</span>
                          <StatusBadge status={tx.status} />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                          {tx.customer_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{tx.customer_name}</span>}
                          {tx.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{tx.customer_email}</span>}
                          {tx.reference && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />Ref: {tx.reference}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDateTime(tx.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold text-foreground font-mono">{fmt(tx.amount_pence)}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{tx.stripe_session_id.slice(0, 18)}…</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            Showing your last 100 transactions. Payment status updates are processed by Stripe webhooks — allow a few minutes for status to update after payment.
          </p>
        </div>
      </div>
    </>
  );
}
