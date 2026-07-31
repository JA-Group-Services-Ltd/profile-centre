import { support } from 'virtual:content';
/**
 * Public Support Page — /support
 * Telephone, opening hours, categories, and support request form.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Mail, Clock, Shield, AlertTriangle, CreditCard,
  HelpCircle, Lock, FileText, User, ChevronDown, ChevronUp,
  CheckCircle2, Send, Loader2, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranding } from '@/lib/branding';
import { useAuth } from '@/lib/auth';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

const CATEGORIES = [
  { value: 'account_access',      label: 'Account access',          icon: Lock },
  { value: 'security_concern',    label: 'Security concern',        icon: Shield },
  { value: 'report_profile',      label: 'Report a profile',        icon: AlertTriangle },
  { value: 'billing',             label: 'Billing',                 icon: CreditCard },
  { value: 'business_cards',      label: 'Business cards',          icon: FileText },
  { value: 'email_signature',     label: 'Email signature',         icon: Mail },
  { value: 'technical_issue',     label: 'Technical issue',         icon: HelpCircle },
  { value: 'privacy_data_request',label: 'Privacy / data request',  icon: User },
  { value: 'other',               label: 'Other',                   icon: HelpCircle },
];

export default function SupportPage() {
  const branding = useBranding();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', category: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Pre-fill name/email from auth context when user is logged in
  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name:  f.name  || user.name  || '',
        email: f.email || user.email || '',
      }));
    }
  }, [user?.id]);

  const isLoggedIn = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.category || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const supportEmail = branding.support_email || 'support@jagroupservices.co.uk';

  return (
    <>
      <Helmet>
        <title>{`Support — ${branding.platform_name || 'Profile Centre'}`}</title>
        <meta name="description" content="Get help with your Profile Centre account. Contact our support team by phone or email, or submit a support request." />
        <link rel="canonical" href={`${APP_URL}/support`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Support — ${branding.platform_name || 'Profile Centre'}`} />
        <meta property="og:description" content="Get help with your Profile Centre account." />
        <meta property="og:url" content={`${APP_URL}/support`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        {/* Hero */}
        <div className="bg-card border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-sm text-muted-foreground mb-2">Support</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">How can we help?</h1>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              Our support team is here to help UK-based account holders with account access, billing, security, and technical issues.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">

          {/* Contact channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Email support</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                For non-urgent queries. We aim to respond within 2 business days.
              </p>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm text-primary hover:underline font-medium break-all"
              >
                {supportEmail}
              </a>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Response times</h2>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex justify-between"><span>Security / account access</span><span className="text-foreground font-medium">Same day</span></li>
                <li className="flex justify-between"><span>Billing queries</span><span className="text-foreground font-medium">1 business day</span></li>
                <li className="flex justify-between"><span>General support</span><span className="text-foreground font-medium">2 business days</span></li>
                <li className="flex justify-between"><span>Data requests (SAR)</span><span className="text-foreground font-medium">Up to 30 days</span></li>
              </ul>
            </div>
          </div>

          {/* Emergency / security guidance */}
          <div className="p-5 rounded-2xl border border-orange-500/30 bg-orange-500/5">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold text-foreground mb-1">Security or account compromise</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you believe your account has been compromised, change your password immediately from the login page, then contact us using the form below and select <strong className="text-foreground">Security concern</strong>. We prioritise these requests.
                  If you have discovered illegal content on a public profile, use the <strong className="text-foreground">Report a profile</strong> option on the profile page or contact us directly.
                </p>
              </div>
            </div>
          </div>

          {/* Support categories */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">What do you need help with?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      form.category === cat.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Support form */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Submit a support request</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This service is available to UK-based account holders aged 18 and over. For general enquiries, use the form below.
            </p>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <h3 className="text-lg font-semibold text-foreground">Request submitted</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Thank you. We have received your request and will respond to <strong>{form.email}</strong> within our standard response times.
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  You can track your ticket and reply to our team from your dashboard.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="/dashboard/support-tickets">
                    <Button size="sm" className="gap-1.5 w-full sm:w-auto">
                      <ExternalLink className="w-3.5 h-3.5" /> View my tickets
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: '', subject: '', message: '' }); }}>
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sup-name">Full name <span className="text-red-500">*</span></Label>
                    <Input
                      id="sup-name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      readOnly={isLoggedIn}
                      className={isLoggedIn ? 'bg-muted/50 cursor-default' : ''}
                      required
                    />
                    {isLoggedIn && (
                      <p className="text-[10px] text-muted-foreground">From your account · <a href="/dashboard/security-settings" className="underline hover:text-foreground">Change</a></p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sup-email">Email address <span className="text-red-500">*</span></Label>
                    <Input
                      id="sup-email"
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      readOnly={isLoggedIn}
                      className={isLoggedIn ? 'bg-muted/50 cursor-default' : ''}
                      required
                    />
                    {isLoggedIn && (
                      <p className="text-[10px] text-muted-foreground">From your account</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sup-category">Category <span className="text-red-500">*</span></Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger id="sup-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sup-subject">Subject</Label>
                  <Input
                    id="sup-subject"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Brief summary of your issue"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sup-message">Message <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="sup-message"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Please describe your issue in as much detail as possible."
                    rows={5}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Submitting…' : 'Submit request'}
                </Button>

                <p className="text-xs text-muted-foreground">
                  By submitting this form you agree to our{' '}
                  <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                  We will use your details only to respond to your request.
                </p>
              </form>
            )}
          </div>

          {/* FAQs */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">Frequently asked questions</h2>
            <div className="space-y-2">
              {support.FAQS.map((faq, i) => (
                <div key={i} className="border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="text-sm font-medium text-foreground">{faq.q}</span>
                    {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Useful links */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border">
            <h2 className="font-semibold text-foreground mb-3">Useful links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                { to: '/legal/privacy',         label: 'Privacy Policy' },
                { to: '/legal/terms',           label: 'Terms of Service' },
                { to: '/legal/refunds',         label: 'Refund Policy' },
                { to: '/legal/complaints',      label: 'Complaints Policy' },
                { to: '/legal/acceptable-use',  label: 'Acceptable Use Policy' },
                { to: '/report-issue',          label: 'Report a technical issue' },
              ].map(l => (
                <a key={l.to} href={l.to} className="text-primary hover:underline flex items-center gap-1">
                  {l.label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
