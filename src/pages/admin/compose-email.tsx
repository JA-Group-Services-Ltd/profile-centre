/**
 * Admin — Compose & Send Email
 * /admin/compose-email
 *
 * Send a custom email to a single user, all users, or users on a specific plan.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Mail, Send, Users, User, CreditCard, Loader2,
  CheckCircle2, AlertCircle, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Plan { id: number; name: string; }

type RecipientType = 'single' | 'all' | 'plan';

export default function AdminComposeEmail() {
  const [searchParams] = useSearchParams();
  const [recipientType, setRecipientType] = useState<RecipientType>('single');
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get('to') || '');
  const [planId, setPlanId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; sent?: number; failed?: number } | null>(null);

  useEffect(() => {
    fetch('/api/admin/plans', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.data.filter((p: any) => p.is_active)); })
      .catch(() => {});
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    if (recipientType === 'single' && !recipientEmail.includes('@')) return;
    if (recipientType === 'plan' && !planId) return;

    if (!confirm(`Send this email to ${recipientType === 'single' ? recipientEmail : recipientType === 'all' ? 'ALL users' : 'users on selected plan'}? This cannot be undone.`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientType,
          recipientEmail: recipientType === 'single' ? recipientEmail.trim() : undefined,
          planId: recipientType === 'plan' ? parseInt(planId) : undefined,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message || data.error, sent: data.sent, failed: data.failed });
      if (data.success) {
        setSubject('');
        setBody('');
        setRecipientEmail('');
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const recipientOptions: { value: RecipientType; label: string; icon: React.ElementType; desc: string }[] = [
    { value: 'single', label: 'Single user', icon: User, desc: 'Send to one specific email address' },
    { value: 'plan', label: 'Users on a plan', icon: CreditCard, desc: 'Send to all users on a specific plan' },
    { value: 'all', label: 'All users', icon: Users, desc: 'Broadcast to every registered user' },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Compose Email — Admin</title>
        <meta name="description" content="Send a custom email to users from the admin portal." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/compose-email" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <Mail className="w-6 h-6 text-primary" /> Compose Email
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Send a custom email to users directly from the admin portal.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-5">

        {/* Recipient type */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">Recipients</CardTitle>
            <CardDescription>Who should receive this email?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recipientOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecipientType(opt.value)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
                    recipientType === opt.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-muted/20 hover:border-primary/40'
                  }`}
                >
                  <opt.icon className={`w-5 h-5 ${recipientType === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${recipientType === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {recipientType === 'single' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Recipient email address</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="bg-background border-border"
                  required
                />
              </div>
            )}

            {recipientType === 'plan' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Select plan</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Choose a plan…" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recipientType === 'all' && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>This will send to <strong>every registered user</strong>. Use with caution.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject line</Label>
              <Input
                placeholder="e.g. Important update about your account"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="bg-background border-border"
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{subject.length}/200</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Message body</Label>
              <Textarea
                placeholder="Write your message here. Keep it clear and concise. Line breaks are preserved."
                value={body}
                onChange={e => setBody(e.target.value)}
                className="bg-background border-border resize-none min-h-[200px]"
                required
              />
              <p className="text-xs text-muted-foreground">Plain text — line breaks are preserved. The email will be wrapped in the Profile Centre branded template.</p>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            result.success
              ? 'bg-green-500/10 border-green-500/20 text-green-700'
              : 'bg-red-500/10 border-red-500/20 text-red-700'
          }`}>
            {result.success
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.sent !== undefined && (
                <p className="text-xs mt-1 opacity-80">
                  {result.sent} sent{result.failed ? `, ${result.failed} failed` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Send button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={sending || !subject.trim() || !body.trim()}
            className="gap-2 px-6"
            size="lg"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      </form>
    </div>
  );
}
