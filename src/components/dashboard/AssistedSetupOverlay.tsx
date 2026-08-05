/**
 * AssistedSetupOverlay
 *
 * Step-by-step guided setup shown to new users on first login.
 * Covers: Personal Profile, Business Profile, Business Seats,
 *         QR Code, Email Signature.
 *
 * - Adapts steps shown based on user's plan access
 * - Each step has a clear description, action button, and "Mark done" option
 * - User can dismiss at any time (auto-expires after 24h)
 * - Can be re-opened from Help Centre
 * - Demo mode has been moved to its own dedicated page (/dashboard/demo)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, CheckCircle2, Circle,
  Building2, Users, QrCode, Mail, User,
  Sparkles, ArrowRight,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
  tip: string;
  actionLabel: string;
  actionPath: string;
  requiresBusiness?: boolean;
  requiresPersonal?: boolean;
}

const ALL_STEPS: Step[] = [
  {
    id: 'personal-profile',
    icon: <User className="w-5 h-5" />,
    title: 'Create your Personal Profile (My Card)',
    description: 'Your digital business card — share it via link or QR code.',
    detail: `Your personal profile is your digital identity. Add your name, photo, job title, bio, skills, and contact links.\n\nOnce published, anyone can view it at your unique URL — no app required. Share the link in emails, on social media, or print the QR code.`,
    tip: 'Start with your name and a profile photo, then add links to your social profiles and contact details.',
    actionLabel: 'Go to My Card',
    actionPath: '/dashboard/profile',
    requiresPersonal: true,
  },
  {
    id: 'business-profile',
    icon: <Building2 className="w-5 h-5" />,
    title: 'Set up your Business Profile',
    description: 'Your company page with services, team, gallery, and more.',
    detail: `Your Business Profile is a full company page — add your business name, logo, services, team members, gallery, opening hours, FAQs, and contact details.\n\nIt has its own public URL and QR code, completely separate from your personal card.`,
    tip: 'Start with your business name and logo, then add your top 3 services.',
    actionLabel: 'Go to Business Profile',
    actionPath: '/dashboard/business-profile',
    requiresBusiness: true,
  },
  {
    id: 'business-seats',
    icon: <Users className="w-5 h-5" />,
    title: 'Invite team members (Business Seats)',
    description: 'Give your team access to manage the business profile.',
    detail: `Business Seats let you invite team members to collaborate on your business profile. Each seat holder gets their own dashboard access.\n\nYou control what each seat holder can see and do — you can restrict access to specific sections.`,
    tip: 'Invite team members by email. They\'ll receive an invitation link to join.',
    actionLabel: 'Manage Business Seats',
    actionPath: '/dashboard/business-seats',
    requiresBusiness: true,
  },
  {
    id: 'qr-code',
    icon: <QrCode className="w-5 h-5" />,
    title: 'Download your QR Code',
    description: 'Print it on materials so people can scan to view your profile.',
    detail: `Your QR code links directly to your profile. Anyone who scans it with their phone camera is taken straight to your Sousa Murray Profiles.\n\nDownload a high-resolution PNG or SVG for use on business cards, posters, email footers, or anywhere else.`,
    tip: 'Add your QR code to your email signature or printed materials for instant profile sharing.',
    actionLabel: 'Get your QR Code',
    actionPath: '/dashboard/qr-code',
  },
  {
    id: 'email-signature',
    icon: <Mail className="w-5 h-5" />,
    title: 'Build your Email Signature',
    description: 'A professional signature that links to your Sousa Murray Profiles.',
    detail: `Your email signature includes your name, title, contact details, and a link (or QR code) to your Sousa Murray Profiles.\n\nCopy the generated HTML and paste it into your email client — Gmail, Outlook, Apple Mail, and more are all supported.`,
    tip: 'Include your profile QR code in your signature so recipients can scan it on printed emails.',
    actionLabel: 'Build Email Signature',
    actionPath: '/dashboard/email-signature',
  },
];

interface Props {
  hasBusinessAccess: boolean;
  hasPersonalAccess: boolean;
  completedSteps: string[];
  onDismiss: () => void;
  onStepComplete: (stepId: string) => void;
}

export default function AssistedSetupOverlay({
  hasBusinessAccess,
  hasPersonalAccess,
  completedSteps,
  onDismiss,
  onStepComplete,
}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const navigate = useNavigate();

  // Filter steps based on user's access
  const steps = ALL_STEPS.filter(s => {
    if (s.requiresBusiness && !hasBusinessAccess) return false;
    if (s.requiresPersonal && !hasPersonalAccess) return false;
    return true;
  });

  const current = steps[activeStep];
  const totalSteps = steps.length;
  const completedCount = steps.filter(s => completedSteps.includes(s.id)).length;
  const allDone = completedCount === totalSteps;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const handleDismiss = () => {
    setDismissing(true);
    onDismiss();
  };

  const handleGo = () => {
    onDismiss();
    navigate(current.actionPath);
  };

  const handleMarkDone = () => {
    if (current) onStepComplete(current.id);
    if (activeStep < totalSteps - 1) setActiveStep(activeStep + 1);
  };

  const goNext = () => { if (activeStep < totalSteps - 1) setActiveStep(activeStep + 1); };
  const goPrev = () => { if (activeStep > 0) setActiveStep(activeStep - 1); };

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9990] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Getting Started</h2>
                <p className="text-xs text-muted-foreground">
                  {allDone
                    ? 'All steps complete — you\'re all set!'
                    : `${completedCount} of ${totalSteps} steps done`}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Dismiss — you can reopen this from Help Centre"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted flex-shrink-0">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Step tabs */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border flex-shrink-0 overflow-x-auto scrollbar-none">
            {steps.map((step, i) => {
              const done = completedSteps.includes(step.id);
              const active = i === activeStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0
                    ${active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : done
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'}`}
                >
                  {done
                    ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    : <Circle className="w-3 h-3 flex-shrink-0" />}
                  <span className="truncate max-w-[80px]">{step.title.split(' ').slice(0, 2).join(' ')}</span>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Step header */}
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                    ${completedSteps.includes(current.id) ? 'bg-green-500/15 text-green-500' : 'bg-primary/15 text-primary'}`}>
                    {completedSteps.includes(current.id)
                      ? <CheckCircle2 className="w-5 h-5" />
                      : current.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">{current.title}</h3>
                      {completedSteps.includes(current.id) && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">Done</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{current.description}</p>
                  </div>
                </div>

                {/* Detail text */}
                <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-3">
                  {current.detail.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm text-foreground/80 leading-relaxed">
                      {para.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </p>
                  ))}
                </div>

                {/* Tip */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <span className="text-primary text-xs font-bold flex-shrink-0 mt-0.5">TIP</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.tip}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              {/* Prev / Next */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={goPrev}
                  disabled={activeStep === 0}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">{activeStep + 1}/{totalSteps}</span>
                <button
                  onClick={goNext}
                  disabled={activeStep === totalSteps - 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {!completedSteps.includes(current.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkDone}
                    className="gap-1.5 text-xs h-8 border-border"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark done
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleGo}
                  className="gap-1.5 text-xs h-8 bg-primary"
                >
                  {current.actionLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {allDone && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20"
              >
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-300">
                  You've completed all setup steps. Your profile is ready to share!
                </p>
                <button
                  onClick={handleDismiss}
                  className="ml-auto text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                  Close <ExternalLink className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
