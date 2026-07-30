/**
 * Admin — Authority & Incident Report Generator
 * /admin/authority-report
 *
 * High-risk: requires admin login + PIN session + high-risk challenge token.
 * Every generation is audit-logged server-side.
 *
 * Separate from SAR Export.
 */
import { useState, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ShieldAlert, FileText, AlertTriangle, CheckCircle2, Loader2,
  AlertCircle, Info, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import PinChallenge from '@/components/admin/PinChallenge';

// ── Types ─────────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  'Internal incident report',
  'Profile report summary',
  'User report summary',
  'Abuse/safety report',
  'Fraud/security report',
  'Police/authority request report',
  'Court/legal request report',
  'Safeguarding concern report',
  'Data disclosure decision record',
] as const;

type ReportType = typeof REPORT_TYPES[number];

const ALL_SECTIONS = [
  'Report summary',
  'Reported profile details',
  'Reported user account summary',
  'Reporter details, if lawful and necessary',
  'Report reason and submitted content',
  'Timeline of events',
  'Public profile snapshot',
  'Enquiries linked to the report',
  'Support tickets linked to the report',
  'Admin notes',
  'Security events',
  'Audit log entries',
  'Actions already taken',
  'Evidence/attachments list',
  'Legal disclosure decision',
] as const;

type Section = typeof ALL_SECTIONS[number];

const REQUEST_TYPES = [
  { value: 'court_order',  label: 'Court Order' },
  { value: 'warrant',      label: 'Warrant' },
  { value: 'statutory',    label: 'Statutory Request' },
  { value: 'voluntary',    label: 'Voluntary Disclosure' },
  { value: 'other',        label: 'Other' },
] as const;

const RISK_LEVELS = [
  { value: 'low',      label: 'Low',      color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'medium',   label: 'Medium',   color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'high',     label: 'High',     color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

function SectionToggle({ section, checked, onChange }: { section: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
      checked ? 'bg-primary/5 border-primary/30 text-foreground' : 'bg-background border-border text-muted-foreground hover:border-primary/20'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary shrink-0"
      />
      <span className="flex-1">{section}</span>
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuthorityReportPage() {
  // Form state
  const [reportType, setReportType]   = useState<ReportType | ''>('');
  const [reason, setReason]           = useState('');
  const [useType, setUseType]         = useState<'internal' | 'external'>('internal');
  const [authorityName, setAuthorityName]   = useState('');
  const [officerName, setOfficerName]       = useState('');
  const [contactEmail, setContactEmail]     = useState('');
  const [contactPhone, setContactPhone]     = useState('');
  const [caseReference, setCaseReference]   = useState('');
  const [requestDate, setRequestDate]       = useState('');
  const [deadline, setDeadline]             = useState('');
  const [legalBasis, setLegalBasis]         = useState('');
  const [requestType, setRequestType]       = useState('');
  const [subjectUserRef, setSubjectUserRef]     = useState(''); // email or user_number
  const [subjectProfileRef, setSubjectProfileRef] = useState(''); // username
  // Lookup state
  const [lookupUser, setLookupUser]   = useState<{ id: number; name: string; email: string; user_number: string | null } | null>(null);
  const [lookupProfile, setLookupProfile] = useState<{ id: number; username: string; display_name: string | null } | null>(null);
  const [lookupUserErr, setLookupUserErr]   = useState('');
  const [lookupProfileErr, setLookupProfileErr] = useState('');
  const [lookingUpUser, setLookingUpUser]   = useState(false);
  const [lookingUpProfile, setLookingUpProfile] = useState(false);
  const [infoRequested, setInfoRequested]   = useState('');
  const [infoIncluded, setInfoIncluded]     = useState('');
  const [infoWithheld, setInfoWithheld]     = useState('');
  const [decisionNote, setDecisionNote]     = useState('');
  const [riskLevel, setRiskLevel]           = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [urgentRisk, setUrgentRisk]         = useState(false);
  const [sections, setSections]             = useState<Set<Section>>(new Set(['Report summary']));

  // UI state
  const [showAuthorityDetails, setShowAuthorityDetails] = useState(false);
  const [pinOpen, setPinOpen]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const toggleSection = useCallback((sec: Section, on: boolean) => {
    setSections(prev => {
      const next = new Set(prev);
      if (on) next.add(sec); else next.delete(sec);
      return next;
    });
  }, []);

  const selectAllSections = () => setSections(new Set(ALL_SECTIONS));
  const clearAllSections  = () => setSections(new Set(['Report summary'] as Section[]));

  // ── Subject lookup helpers ─────────────────────────────────────────────────
  const lookupUserByRef = async () => {
    const ref = subjectUserRef.trim();
    if (!ref) return;
    setLookingUpUser(true); setLookupUserErr(''); setLookupUser(null);
    try {
      const r = await fetch(`/api/admin/users/lookup?ref=${encodeURIComponent(ref)}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success && d.user) {
        setLookupUser(d.user);
      } else {
        setLookupUserErr(d.error || 'No user found with that email or user number.');
      }
    } catch { setLookupUserErr('Lookup failed — check connection.'); }
    finally { setLookingUpUser(false); }
  };

  const lookupProfileByUsername = async () => {
    const ref = subjectProfileRef.trim();
    if (!ref) return;
    setLookingUpProfile(true); setLookupProfileErr(''); setLookupProfile(null);
    try {
      const r = await fetch(`/api/admin/profiles/lookup?username=${encodeURIComponent(ref)}`, { credentials: 'include' });
      const d = await r.json();
      if (d.success && d.profile) {
        setLookupProfile(d.profile);
      } else {
        setLookupProfileErr(d.error || 'No profile found with that username.');
      }
    } catch { setLookupProfileErr('Lookup failed — check connection.'); }
    finally { setLookingUpProfile(false); }
  };

  // Validation
  const validate = (): string | null => {
    if (!reportType)          return 'Select a report type.';
    if (!reason.trim())       return 'Reason for report is required.';
    if (!infoRequested.trim()) return 'Information requested is required.';
    if (!infoIncluded.trim()) return 'Information included is required.';
    if (!decisionNote.trim()) return 'Admin decision note is required.';
    if (sections.size === 0)  return 'Select at least one section.';
    return null;
  };

  const handleGenerate = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setPinOpen(true);
  };

  const doGenerate = async (challengeToken: string) => {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        reportType,
        reason,
        useType,
        authorityName:   useType === 'external' ? authorityName   : undefined,
        officerName:     useType === 'external' ? officerName     : undefined,
        contactEmail:    useType === 'external' ? contactEmail    : undefined,
        contactPhone:    useType === 'external' ? contactPhone    : undefined,
        caseReference:   useType === 'external' ? caseReference   : undefined,
        requestDate:     useType === 'external' ? requestDate     : undefined,
        deadline:        useType === 'external' ? deadline        : undefined,
        legalBasis,
        requestType:     useType === 'external' ? requestType     : undefined,
        subjectUserId:   lookupUser?.id,
        subjectProfileId: lookupProfile?.id,
        informationRequested: infoRequested,
        informationIncluded:  infoIncluded,
        informationWithheld:  infoWithheld,
        adminDecisionNote:    decisionNote,
        riskLevel,
        urgentRisk,
        sections: Array.from(sections),
      };

      const res = await fetch('/api/admin/authority-report/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin-Token':  challengeToken,
          'X-Admin-Pin-Action': 'authority_report',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      // Download PDF
      const blob = await res.blob();
      const ref  = res.headers.get('X-Report-Ref') ?? 'report';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `authority-report-${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Report generated and downloaded. Reference: ${ref}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 lg:pb-0 space-y-6">
      <Helmet>
        <title>Authority &amp; Incident Report — Staff Portal</title>
        <meta name="description" content="Generate authority and incident reports for JA Profile Studio." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/authority-report" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Authority &amp; Incident Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generate a formal report for internal incidents, authority requests, or legal disclosures.
            Separate from SAR Export.
          </p>
        </div>
      </div>

      {/* Compliance notice */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-foreground">Compliance Notice</p>
            <p className="text-muted-foreground leading-relaxed">
              Only disclose personal data where JA Group Services Ltd has a lawful basis and the disclosure is
              necessary and proportionate. If unsure, seek legal or data protection advice before disclosure.
              This system helps you document the decision — it does not make it for you.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security notice */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">High-Risk Action</p>
            <p className="text-muted-foreground">
              Generating this report requires your Admin PIN and a high-risk confirmation. Every generation is
              recorded in the audit log including your name, the report type, sections selected, and reason.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Step 1: Report Type ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
            Report Type
          </CardTitle>
          <CardDescription>Select the type of report you are generating.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {REPORT_TYPES.map(rt => (
            <label key={rt} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
              reportType === rt
                ? 'bg-primary/5 border-primary/40 text-foreground font-medium'
                : 'bg-background border-border text-muted-foreground hover:border-primary/20'
            }`}>
              <input
                type="radio"
                name="reportType"
                value={rt}
                checked={reportType === rt}
                onChange={() => setReportType(rt)}
                className="accent-primary shrink-0"
              />
              {rt}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* ── Step 2: Basic Details ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span>
            Report Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Reason */}
          <div>
            <FieldLabel required>Reason for Report</FieldLabel>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe why this report is being generated..."
              rows={3}
              className="bg-background border-border resize-none"
            />
          </div>

          {/* Internal / External */}
          <div>
            <FieldLabel required>Use</FieldLabel>
            <div className="flex gap-3">
              {(['internal', 'external'] as const).map(ut => (
                <label key={ut} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                  useType === ut ? 'bg-primary/5 border-primary/40 text-foreground' : 'bg-background border-border text-muted-foreground hover:border-primary/20'
                }`}>
                  <input type="radio" name="useType" value={ut} checked={useType === ut} onChange={() => { setUseType(ut); setShowAuthorityDetails(ut === 'external'); }} className="accent-primary" />
                  {ut === 'internal' ? 'Internal Use' : 'External / Authority'}
                </label>
              ))}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <FieldLabel required>Risk Level</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {RISK_LEVELS.map(rl => (
                <label key={rl.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                  riskLevel === rl.value ? rl.color + ' border-current' : 'bg-background border-border text-muted-foreground hover:border-primary/20'
                }`}>
                  <input type="radio" name="riskLevel" value={rl.value} checked={riskLevel === rl.value} onChange={() => setRiskLevel(rl.value)} className="accent-primary" />
                  {rl.label}
                </label>
              ))}
            </div>
          </div>

          {/* Urgent risk */}
          <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
            urgentRisk ? 'bg-red-500/5 border-red-500/30' : 'bg-background border-border hover:border-red-300'
          }`}>
            <input type="checkbox" checked={urgentRisk} onChange={e => setUrgentRisk(e.target.checked)} className="w-4 h-4 accent-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Urgent Risk Exists</p>
              <p className="text-xs text-muted-foreground">Check if there is an immediate risk to a person's safety or wellbeing.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* ── Step 3: Authority Details (external only) ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowAuthorityDetails(v => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</span>
              Authority / External Request Details
              {useType === 'external' && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs ml-1">Required for external</Badge>}
              {useType === 'internal' && <Badge className="bg-muted text-muted-foreground border-border text-xs ml-1">Optional for internal</Badge>}
            </CardTitle>
            {showAuthorityDetails ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
          <CardDescription>Complete if responding to a police, court, or authority request.</CardDescription>
        </CardHeader>
        {showAuthorityDetails && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Authority / Body Name</FieldLabel>
                <Input value={authorityName} onChange={e => setAuthorityName(e.target.value)} placeholder="e.g. Metropolitan Police" className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Officer / Contact Name</FieldLabel>
                <Input value={officerName} onChange={e => setOfficerName(e.target.value)} placeholder="e.g. DC Smith" className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Contact Email</FieldLabel>
                <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="officer@police.gov.uk" className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Contact Phone</FieldLabel>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+44..." className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Case / Reference Number</FieldLabel>
                <Input value={caseReference} onChange={e => setCaseReference(e.target.value)} placeholder="e.g. CAD/2026/12345" className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Request Date</FieldLabel>
                <Input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Deadline</FieldLabel>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-background border-border" />
              </div>
              <div>
                <FieldLabel>Request Category</FieldLabel>
                <select
                  value={requestType}
                  onChange={e => setRequestType(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Select...</option>
                  {REQUEST_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>Legal Basis / Request Type</FieldLabel>
              <Textarea
                value={legalBasis}
                onChange={e => setLegalBasis(e.target.value)}
                placeholder="e.g. Section 29 DPA 2018 — crime prevention and detection. Voluntary disclosure under legitimate interests..."
                rows={3}
                className="bg-background border-border resize-none"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Step 4: Subject ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">4</span>
            Subject (Optional)
          </CardTitle>
          <CardDescription>If this report relates to a specific user or profile, look them up to include their account data in the report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* User lookup */}
          <div className="space-y-2">
            <FieldLabel>Email or JA Profile Studio User Number</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={subjectUserRef}
                onChange={e => { setSubjectUserRef(e.target.value); setLookupUser(null); setLookupUserErr(''); }}
                onKeyDown={e => e.key === 'Enter' && lookupUserByRef()}
                placeholder="e.g. user@email.com or JA-00042"
                className="bg-background border-border text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!subjectUserRef.trim() || lookingUpUser}
                onClick={lookupUserByRef}
                className="shrink-0 text-xs h-9 px-3"
              >
                {lookingUpUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Look up'}
              </Button>
            </div>
            {lookupUserErr && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {lookupUserErr}
              </p>
            )}
            {lookupUser && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/8 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-foreground">{lookupUser.name}</p>
                  <p className="text-muted-foreground">{lookupUser.email}</p>
                  {lookupUser.user_number && <p className="text-muted-foreground">User number: {lookupUser.user_number}</p>}
                  <p className="text-muted-foreground">Internal ID: {lookupUser.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setLookupUser(null); setSubjectUserRef(''); }}
                  className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                >✕</button>
              </div>
            )}
          </div>

          {/* Profile lookup */}
          <div className="space-y-2">
            <FieldLabel>Profile Username</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={subjectProfileRef}
                onChange={e => { setSubjectProfileRef(e.target.value); setLookupProfile(null); setLookupProfileErr(''); }}
                onKeyDown={e => e.key === 'Enter' && lookupProfileByUsername()}
                placeholder="e.g. john-smith"
                className="bg-background border-border text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!subjectProfileRef.trim() || lookingUpProfile}
                onClick={lookupProfileByUsername}
                className="shrink-0 text-xs h-9 px-3"
              >
                {lookingUpProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Look up'}
              </Button>
            </div>
            {lookupProfileErr && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {lookupProfileErr}
              </p>
            )}
            {lookupProfile && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/8 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-foreground">{lookupProfile.display_name ?? lookupProfile.username}</p>
                  <p className="text-muted-foreground">@{lookupProfile.username}</p>
                  <p className="text-muted-foreground">Internal ID: {lookupProfile.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setLookupProfile(null); setSubjectProfileRef(''); }}
                  className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                >✕</button>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* ── Step 5: Data Decisions ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">5</span>
            Data Disclosure Decision
          </CardTitle>
          <CardDescription>Document exactly what is being included, withheld, and why.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <FieldLabel required>What information was requested</FieldLabel>
            <Textarea
              value={infoRequested}
              onChange={e => setInfoRequested(e.target.value)}
              placeholder="Describe what the authority or internal team requested..."
              rows={3}
              className="bg-background border-border resize-none"
            />
          </div>
          <div>
            <FieldLabel required>What information will be included</FieldLabel>
            <Textarea
              value={infoIncluded}
              onChange={e => setInfoIncluded(e.target.value)}
              placeholder="List the data categories and specific fields being disclosed..."
              rows={3}
              className="bg-background border-border resize-none"
            />
          </div>
          <div>
            <FieldLabel>What information will be withheld</FieldLabel>
            <Textarea
              value={infoWithheld}
              onChange={e => setInfoWithheld(e.target.value)}
              placeholder="List any data being withheld and the reason (e.g. not relevant, third-party data, disproportionate)..."
              rows={3}
              className="bg-background border-border resize-none"
            />
          </div>
          <div>
            <FieldLabel required>Admin decision note</FieldLabel>
            <Textarea
              value={decisionNote}
              onChange={e => setDecisionNote(e.target.value)}
              placeholder="Explain the decision — necessity, proportionality, lawful basis, who approved it..."
              rows={4}
              className="bg-background border-border resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Step 6: Sections ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">6</span>
              PDF Sections
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllSections} className="border-border text-xs h-7">Select All</Button>
              <Button variant="outline" size="sm" onClick={clearAllSections} className="border-border text-xs h-7">Clear</Button>
            </div>
          </div>
          <CardDescription>
            Select only the sections relevant to this report. Do not include data that is not necessary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_SECTIONS.map(sec => (
              <SectionToggle
                key={sec}
                section={sec}
                checked={sections.has(sec)}
                onChange={on => toggleSection(sec, on)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {sections.size} section{sections.size !== 1 ? 's' : ''} selected. Only include what is necessary and proportionate.
          </p>
        </CardContent>
      </Card>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border bg-destructive/5 border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border bg-green-500/5 border-green-500/20 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Generate button */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-semibold text-foreground text-sm">Generate Authority &amp; Incident Report PDF</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requires high-risk PIN confirmation. Generation is audit-logged.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-red-600 hover:bg-red-700 text-white gap-2 shrink-0"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                : <><FileText className="w-4 h-4" /> Generate Report PDF</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PIN Challenge */}
      <PinChallenge
        open={pinOpen}
        action="authority_report"
        onSuccess={token => { setPinOpen(false); doGenerate(token); }}
        onCancel={() => setPinOpen(false)}
      />
    </div>
  );
}
