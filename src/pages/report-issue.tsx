/**
 * Public — Report an Issue
 * Anyone can submit a bug report or platform issue.
 * Admin is notified by email.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, CheckCircle, Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ISSUE_TYPES = [
  { value: 'bug', label: 'Bug / Something is broken' },
  { value: 'display', label: 'Display / Visual problem' },
  { value: 'performance', label: 'Slow performance' },
  { value: 'account', label: 'Account / Login issue' },
  { value: 'billing', label: 'Billing / Payment issue' },
  { value: 'security', label: 'Security concern' },
  { value: 'other', label: 'Other' },
];

export default function ReportIssuePage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    issue_type: '',
    subject: '',
    description: '',
    url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.issue_type || !form.description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Report an Issue — Profile Centre</title>
        <meta name="description" content="Report a bug, display problem, or platform issue to the Profile Centre team." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/report-issue" />
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Minimal header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <span className="font-bold text-xl tracking-tight text-foreground">Profile Centre</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {submitted ? (
            <Card className="bg-card border-border text-center">
              <CardContent className="py-14">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Report Submitted</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Thank you for letting us know. Our team has been notified and will look into this as soon as possible.
                  {form.email && (
                    <> We may follow up at <strong className="text-foreground">{form.email}</strong> if we need more details.</>
                  )}
                </p>
                <div className="flex gap-3 justify-center">
                  <Link to="/">
                    <Button variant="outline" className="border-border gap-2">
                      <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Button>
                  </Link>
                  <Button
                    className="bg-primary gap-2"
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', issue_type: '', subject: '', description: '', url: '' }); }}
                  >
                    Report Another Issue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Report an Issue</h1>
                <p className="text-muted-foreground text-sm">
                  Found a bug or something not working as expected? Let us know and we'll get it fixed.
                </p>
              </div>

              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Issue Details</CardTitle>
                  <CardDescription>Fields marked * are required</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Your Name *</Label>
                        <Input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Jane Smith"
                          className="mt-1.5 bg-background border-border"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Email Address *</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="jane@example.com"
                          className="mt-1.5 bg-background border-border"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Issue Type *</Label>
                      <Select
                        value={form.issue_type}
                        onValueChange={v => setForm(f => ({ ...f, issue_type: v }))}
                      >
                        <SelectTrigger className="mt-1.5 bg-background border-border">
                          <SelectValue placeholder="Select issue type…" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {ISSUE_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Subject</Label>
                      <Input
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Brief summary of the issue"
                        className="mt-1.5 bg-background border-border"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Description *</Label>
                      <Textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Describe what happened, what you expected to happen, and any steps to reproduce the issue…"
                        className="mt-1.5 bg-background border-border resize-none"
                        rows={5}
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Page URL (optional)</Label>
                      <Input
                        value={form.url}
                        onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                        placeholder="https://japrofilestudio.jagroupservices.co.uk/…"
                        className="mt-1.5 bg-background border-border"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
                      </div>
                    )}

                    <Button type="submit" disabled={submitting} className="w-full bg-primary gap-2">
                      <Send className="w-4 h-4" />
                      {submitting ? 'Submitting…' : 'Submit Report'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Profile Centre · JA Group Services Ltd ·{' '}
          <a href="mailto:japrofilestudio@jagroupservices.co.uk" className="hover:text-foreground transition-colors">
            japrofilestudio@jagroupservices.co.uk
          </a>
        </p>
      </footer>
    </div>
  );
}
