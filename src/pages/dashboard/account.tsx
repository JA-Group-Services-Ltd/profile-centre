/**
 * Dashboard — Account page
 * Shows the customer's account details, plan/subscription status,
 * and a support request form.
 */
import { useState } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  User, Mail, Shield, ExternalLink, Send, Check, Calendar,
  Zap, HelpCircle, ChevronDown, ChevronUp, Edit2, AlertCircle,
  Star, Clock, Crown, Users, AlertTriangle, ArrowRight, Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';

const SUBJECTS = [
  'General enquiry',
  'Billing question',
  'Technical issue',
  'Account access problem',
  'Feature request',
  'Other',
];

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const branding = useBranding();

  // Support form
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit name/email
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  if (!user) return null;

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map(n => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const planLabel = user.lifetime_access
    ? `${user.plan_name ?? 'Pro'} (Lifetime)`
    : user.plan_name ?? 'Free';

  const periodEnd = user.current_period_end
    ? fmtDate(user.current_period_end, 'long')
    : null;

  const memberSince = user.created_at
    ? fmtDate(user.created_at, 'long')
    : null;

  const submitRequest = async () => {
    setFormError('');
    if (!subject) { setFormError('Please select a subject.'); return; }
    if (!message.trim()) { setFormError('Please describe your issue.'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: user.id, name: user.name, email: user.email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setSent(true);
      setSubject('');
      setMessage('');
      setTimeout(() => { setSent(false); setShowForm(false); }, 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const startEdit = () => {
    setEditName(user.name);
    setEditEmail(user.email);
    setSaveError('');
    setSaveSuccess(false);
    setEditMode(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) { setSaveError('Name is required'); return; }
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/.test(editEmail)) { setSaveError('Enter a valid email address'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/account/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      await refreshUser();
      setSaveSuccess(true);
      setEditMode(false);
      setTimeout(() => setSaveSuccess(false), 3000);
      // If the display name sync to JA Group Services ID had a note, show it briefly
      if (data.entraError) {
        setSyncNote('Your details were saved. Your display name in JA Group Services ID may take a moment to update.');
        setTimeout(() => setSyncNote(''), 12000);
      } else {
        setSyncNote('');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>My Account — JA Profile Studio</title>
        <meta name="description" content="Manage your account details and membership." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/account" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground mt-1">Your account details and membership information</p>
      </div>

      {/* Profile summary */}
      <Card className="bg-card border-border mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-xl">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{user.name}</h2>
              <p className="text-muted-foreground text-sm truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs capitalize">{user.role}</Badge>
                {user.hasLifetimeAccess && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs gap-1"><Crown className="w-3 h-3" /> Lifetime</Badge>}
                {user.trialActive && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs gap-1"><Clock className="w-3 h-3" /> Trial active</Badge>}
                {user.trialExpired && !user.hasBusinessAccess && !user.hasStarterAccess && !user.hasLifetimeAccess && !user.isSeatUser && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1"><AlertTriangle className="w-3 h-3" /> Trial expired</Badge>}
                {user.hasBusinessAccess && !user.trialActive && !user.hasLifetimeAccess && <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs gap-1"><Zap className="w-3 h-3" /> {user.plan_name ?? 'Business'}</Badge>}
                {user.hasStarterAccess && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs gap-1"><Star className="w-3 h-3" /> {user.plan_name ?? 'Starter'}</Badge>}
                {user.isSeatUser && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs gap-1"><Users className="w-3 h-3" /> Seat member</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account details */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Account Details
              </CardTitle>
              <CardDescription>Update your name and email address</CardDescription>
            </div>
            {!editMode && (
              <Button size="sm" variant="outline" className="border-border gap-1.5" onClick={startEdit}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-foreground">First / Full Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)}
                  className="bg-background border-border mt-1" placeholder="Your name" />
              </div>
              <div>
                <Label className="text-sm text-foreground">Email Address</Label>
                <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  className="bg-background border-border mt-1" placeholder="your@email.com" />
              </div>
              {saveError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />{saveError}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveProfile} disabled={saving} className="bg-primary gap-1.5">
                  {saving ? 'Saving…' : <><Check className="w-4 h-4" /> Save Changes</>}
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)} className="border-border">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {saveSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm pb-3">
                  <Check className="w-4 h-4" /> Account details updated successfully
                </div>
              )}
              {syncNote && (
                <div className="flex items-start gap-2 text-blue-600 dark:text-blue-400 text-sm pb-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{syncNote}</span>
                </div>
              )}
              {[
                { icon: User,     label: 'Full Name',     value: user.name },
                { icon: Mail,     label: 'Email Address', value: user.email },
                { icon: Shield,   label: 'Universal Customer Number (UCN)', value: user.customer_number ?? 'Pending Head Office link' },
                { icon: Shield,   label: 'Account Type',  value: 'JA Group Services ID' },
                { icon: Calendar, label: 'Member Since',  value: memberSince ?? '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium text-foreground truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan & subscription — rich card */}
      <Card className="bg-card border-border mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current plan</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xl font-bold text-foreground">{planLabel}</p>
                {user.lifetime_access ? (
                  <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/20 gap-1"><Crown className="w-3 h-3" /> Lifetime</Badge>
                ) : user.trialActive ? (
                  <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/20 gap-1"><Clock className="w-3 h-3" /> Trial active</Badge>
                ) : user.hasBusinessAccess ? (
                  <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/20 gap-1"><Zap className="w-3 h-3" /> Active</Badge>
                ) : user.hasStarterAccess ? (
                  <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/20 gap-1"><Star className="w-3 h-3" /> Active</Badge>
                ) : user.isSeatUser ? (
                  <Badge className="bg-green-500/15 text-green-500 border-green-500/20 gap-1"><Users className="w-3 h-3" /> Seat member</Badge>
                ) : user.trialExpired ? (
                  <Badge className="bg-red-500/15 text-red-500 border-red-500/20 gap-1"><AlertTriangle className="w-3 h-3" /> Trial expired</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground border-border">Free</Badge>
                )}
              </div>
            </div>
            <Link to="/dashboard/billing">
              <Button variant="outline" size="sm" className="border-border gap-1.5 text-xs flex-shrink-0">
                {user.hasFreeAccess && !user.trialActive ? 'Upgrade' : 'Manage'} <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>

        <CardContent className="p-6 space-y-0">
          <div className="divide-y divide-border/50">
            {/* Subscription status */}
            {user.subscription_status && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Subscription status</span>
                <span className="text-xs font-medium text-foreground capitalize">{user.subscription_status.replace(/_/g, ' ')}</span>
              </div>
            )}
            {/* Billing interval */}
            {user.billing_interval && !user.lifetime_access && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Billing cycle</span>
                <span className="text-xs font-medium text-foreground capitalize">{user.billing_interval}ly</span>
              </div>
            )}
            {/* Renewal / access until */}
            {periodEnd && !user.lifetime_access && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">
                  {user.subscription_status === 'cancelled' ? 'Access until' : 'Renews'}
                </span>
                <span className="text-xs font-medium text-foreground">{periodEnd}</span>
              </div>
            )}
            {/* Trial end date */}
            {user.trialActive && user.trialEndsAt && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Trial ends</span>
                <span className="text-xs font-medium text-blue-500">
                  {fmtDate(user.trialEndsAt, 'long')}
                </span>
              </div>
            )}
            {/* Seat workspace */}
            {user.isSeatUser && user.seatWorkspaces?.[0] && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Workspace</span>
                <span className="text-xs font-medium text-foreground">{user.seatWorkspaces[0].businessName}</span>
              </div>
            )}
            {user.isSeatUser && user.seatWorkspaces?.[0] && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Your role</span>
                <span className="text-xs font-medium text-foreground capitalize">{user.seatWorkspaces[0].role}</span>
              </div>
            )}
            {/* Member since */}
            {memberSince && (
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-muted-foreground">Member since</span>
                <span className="text-xs font-medium text-foreground">{memberSince}</span>
              </div>
            )}
          </div>

          {/* Upgrade CTA for free/expired users */}
          {(user.hasFreeAccess || user.trialExpired) && !user.isSeatUser && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-primary" />
                    {user.trialExpired ? 'Your trial has ended' : 'Unlock all features'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.trialExpired
                      ? 'Subscribe to a paid plan to restore access to your profile and features.'
                      : 'Start your free 30-day trial — no credit card required.'}
                  </p>
                </div>
                <Link to="/dashboard/billing" className="flex-shrink-0">
                  <Button size="sm" className="bg-primary gap-1.5">
                    {user.trialExpired ? 'View plans' : 'Start trial'} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Trial active — upgrade nudge */}
          {user.trialActive && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-500" /> Trial in progress
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upgrade before your trial ends to keep uninterrupted access.
                  </p>
                </div>
                <Link to="/dashboard/billing" className="flex-shrink-0">
                  <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 gap-1.5">
                    Upgrade <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Locked features notice for seat users */}
          {user.isSeatUser && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="rounded-xl bg-muted/30 border border-border p-4 flex items-start gap-3">
                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Your access is managed by your workspace owner. Billing and plan changes are handled by them.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support request */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" /> Support
              </CardTitle>
              <CardDescription className="mt-1">Get help from the {branding.platform_name ?? 'JA Profile Studio'} team</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border gap-1.5"
              onClick={() => { setShowForm(f => !f); setSent(false); setFormError(''); }}
            >
              {showForm ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5" /> New Request</>}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-4 pt-0">
            {sent ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">Request sent! We'll get back to you at <strong>{user.email}</strong>.</p>
              </div>
            ) : (
              <>
                {formError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{formError}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Your Name</Label>
                    <Input value={user.name} disabled className="bg-muted/50 border-border text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                    <Input value={user.email} disabled className="bg-muted/50 border-border text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select a subject…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Message</Label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe your issue or question in as much detail as possible…"
                    className="bg-background border-border min-h-[120px] resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={submitRequest} disabled={sending} className="bg-primary gap-2">
                    {sending ? 'Sending…' : <><Send className="w-3.5 h-3.5" /> Send Request</>}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}

        {!showForm && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              For account queries, billing questions, or technical support — we typically respond within 1 business day.
            </p>
            <a href={`mailto:${branding.support_email || 'japrofilestudio@jagroupservices.co.uk'}`}>
              <Button variant="outline" size="sm" className="border-border gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {branding.support_email || 'japrofilestudio@jagroupservices.co.uk'}
              </Button>
            </a>
          </CardContent>
        )}
      </Card>

      {/* Settings shortcut */}
      <Card className="bg-muted/20 border-border">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Update your display name</p>
            <p className="text-xs text-muted-foreground mt-0.5">Change how your name appears across your profiles</p>
          </div>
          <Link to="/dashboard/settings">
            <Button variant="outline" size="sm" className="border-border gap-1.5">
              Settings <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
