/**
 * Public Help Centre — /help
 * Accessible to all visitors without login.
 * Covers common questions about Profile Centre.
 */
import { useState, useMemo } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Search, ChevronDown, BookOpen, User, Link2, CreditCard, Shield, QrCode, FileText, HelpCircle, Zap, Flag, Mail, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

interface Article { id: string; title: string; body: string; tags: string[]; }
interface Category { id: string; icon: React.ReactNode; title: string; description: string; color: string; articles: Article[]; }

const CATEGORIES: Category[] = [
  {
    id: 'getting-started',
    icon: <Zap className="w-5 h-5" />,
    title: 'Getting Started',
    description: 'Create your account and set up your first profile',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    articles: [
      { id: 'gs-1', title: 'How do I create an account?', tags: ['account', 'signup', 'login'],
        body: 'Your Profile Centre account is created when you sign in for the first time using your Microsoft account. Click "Log In" on the homepage and authenticate with Microsoft. Your account is created automatically — no separate registration is needed.\n\nIf you have trouble signing in, make sure you are using the correct Microsoft account.' },
      { id: 'gs-2', title: 'What is Profile Centre?', tags: ['overview', 'about'],
        body: 'Profile Centre is a digital profile service that lets you keep your contact details, business information, links and QR code in one place. You can share your profile using a link, QR code, email signature, or printed materials.\n\nYour profile has a unique public URL that you can share with anyone.' },
      { id: 'gs-3', title: 'What is included in the free plan?', tags: ['free', 'plan', 'pricing'],
        body: 'The free plan includes:\n\n• 1 digital profile\n• 1 custom link\n• QR code for your profile\n• Public profile URL\n• Basic contact information\n\nThe free plan does not require a credit card. You can upgrade to a paid plan at any time to unlock more features.' },
    ],
  },
  {
    id: 'profiles',
    icon: <User className="w-5 h-5" />,
    title: 'Profiles',
    description: 'Create and manage your digital profiles',
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    articles: [
      { id: 'p-1', title: 'How do I create a profile?', tags: ['profile', 'create'],
        body: 'Go to your Dashboard and click "Profile" in the sidebar. Fill in your name, job title, business details and contact information. Your profile is saved automatically as you make changes.\n\nYour profile will have a unique public URL like: japrofilestudio.jagroupservices.co.uk/your-username\n\nYou can create a Personal profile (for individuals) or a Business profile (for companies and brands).' },
      { id: 'p-2', title: 'Can I make my profile private?', tags: ['profile', 'privacy', 'visibility'],
        body: 'Yes. In your profile settings you can set your profile to private. A private profile will not be visible to the public and will not appear in search engines.\n\nYou can also add a PIN to your profile so only people who know the PIN can view it. This is useful for profiles you only want to share with specific people.' },
      { id: 'p-3', title: 'How do I share my profile?', tags: ['share', 'qr', 'link'],
        body: 'You can share your profile in several ways:\n\n• Copy your profile URL from the dashboard\n• Download your QR code and print it on materials\n• Add your profile link to your email signature\n• Share on social media\n\nYour QR code is available in the QR Code section of your dashboard.' },
      { id: 'p-4', title: 'Can I customise my profile with my own design?', tags: ['site editor', 'custom', 'html', 'css', 'design'],
        body: 'Yes. The Site Editor (available on plans that include this feature) lets you customise your profile page with your own HTML and CSS.\n\nYour custom CSS is automatically scoped to your profile content area — it cannot affect the platform\'s report button, legal footer, or other platform controls.\n\nTo use the Site Editor, go to Dashboard → Site Editor, activate it for your profile type, and write your HTML and CSS. You can save drafts and publish when ready.' },
    ],
  },
  {
    id: 'links',
    icon: <Link2 className="w-5 h-5" />,
    title: 'Links',
    description: 'Add and manage links on your profile',
    color: 'text-green-600 bg-green-50 border-green-200',
    articles: [
      { id: 'l-1', title: 'How do I add links to my profile?', tags: ['links', 'social', 'website'],
        body: 'Go to Dashboard → Links. Click "Add Link" and enter the URL and a label. You can add links to your website, social media profiles, portfolio, or any other URL.\n\nThe free plan includes 1 link. Paid plans include more links.' },
      { id: 'l-2', title: 'What types of links can I add?', tags: ['links', 'social'],
        body: 'You can add any URL as a link, including:\n\n• Website URLs\n• LinkedIn, Twitter/X, Instagram, Facebook\n• YouTube, TikTok\n• Portfolio or booking pages\n• Any other web address\n\nLinks are displayed on your public profile for visitors to click.' },
    ],
  },
  {
    id: 'billing',
    icon: <CreditCard className="w-5 h-5" />,
    title: 'Billing & Plans',
    description: 'Manage your subscription and payments',
    color: 'text-blue-400 bg-blue-500/5 border-blue-500/20',
    articles: [
      { id: 'b-1', title: 'How do I upgrade my plan?', tags: ['upgrade', 'plan', 'billing', 'stripe'],
        body: 'Go to Dashboard → Billing. You will see the available plans and their features. Click "Upgrade" on the plan you want. You will be taken to a secure Stripe checkout to complete payment.\n\nPaid plans include a 30-day free trial — no credit card required to start the trial.' },
      { id: 'b-2', title: 'How do I cancel my subscription?', tags: ['cancel', 'subscription', 'downgrade'],
        body: 'Go to Dashboard → Billing and click "Cancel Subscription". Your paid access will continue until the end of your current billing period, after which your account will move to the free plan.\n\nYou will not be charged again after cancellation.' },
      { id: 'b-3', title: 'How does the free trial work?', tags: ['trial', 'free', 'plan'],
        body: 'Paid plans include a 30-day free trial. You do not need a credit card to start a trial. At the end of the trial period, you can choose to subscribe or your account will move to the free plan.\n\nYou will receive a notification before your trial ends.' },
      { id: 'b-4', title: 'How do I pay for Business Cards?', tags: ['business cards', 'payment', 'invoice'],
        body: 'Printed Business Cards are available to order through your dashboard. When you request business cards, an admin will confirm the price and create a Stripe invoice or Stripe payment link. Only pay using an official Stripe invoice or payment link from Profile Centre / JA Group Services Ltd.\n\nDo not pay via any other method unless confirmed in writing by JA Group Services Ltd.' },
    ],
  },
  {
    id: 'privacy',
    icon: <Shield className="w-5 h-5" />,
    title: 'Privacy & Data',
    description: 'Your data rights and privacy controls',
    color: 'text-red-600 bg-red-50 border-red-200',
    articles: [
      { id: 'pr-1', title: 'How do I request a copy of my data (SAR)?', tags: ['sar', 'data', 'gdpr', 'privacy'],
        body: 'You have the right to request a copy of all personal data we hold about you. Go to Dashboard → Data Requests and submit a Subject Access Request.\n\nYou can also download a self-service export of your data at any time from Dashboard → Data Requests → Export My Data. The export covers all 21 data sections we hold about you.\n\nWe will respond to formal SAR requests within 30 days as required by UK GDPR.' },
      { id: 'pr-2', title: 'How do I delete my account?', tags: ['delete', 'account', 'gdpr'],
        body: 'Go to Dashboard → Account Closure, or submit a data deletion request via Dashboard → Data Requests.\n\nAccount deletion is permanent. All your data, profiles and links will be removed.' },
      { id: 'pr-3', title: 'Is my data shared with third parties?', tags: ['data', 'privacy', 'sharing'],
        body: 'We do not sell your personal data. We may share data with trusted service providers (such as Stripe for payments and Microsoft for authentication) only as necessary to operate the platform.\n\nSee our Privacy Policy for full details.' },
    ],
  },
  {
    id: 'qr',
    icon: <QrCode className="w-5 h-5" />,
    title: 'QR Codes',
    description: 'Generate and use your profile QR code',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    articles: [
      { id: 'qr-1', title: 'How do I get my QR code?', tags: ['qr', 'download'],
        body: 'Go to Dashboard → QR Code. Your QR code is generated automatically for your profile. You can download it as a PNG or SVG file.\n\nYour QR code links directly to your public profile URL.' },
      { id: 'qr-2', title: 'Can I put my QR code on printed materials?', tags: ['qr', 'print', 'business cards'],
        body: 'Yes. Download your QR code from the dashboard and use it on business cards, flyers, posters, email signatures or any printed material.\n\nIf you want printed business cards with your QR code, you can request them via Dashboard → Business Cards.' },
    ],
  },
  {
    id: 'email-signature',
    icon: <Mail className="w-5 h-5" />,
    title: 'Email Signature',
    description: 'Professional email signature with your profile link',
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    articles: [
      { id: 'es-1', title: 'Is the Email Signature feature available?', tags: ['email', 'signature', 'coming soon'],
        body: 'The Email Signature feature is coming soon. It will let you create a professional email signature that includes your profile link, photo, contact details, and social links.\n\nWhen it launches, you will be able to:\n• Choose from a range of professional signature templates\n• Customise colours, layout, and the information shown\n• Copy the signature as formatted HTML or plain text\n• Paste directly into Gmail, Outlook, Apple Mail, and other email clients\n\nYou will be notified when the Email Signature feature is available for your account.' },
    ],
  },
  {
    id: 'reporting',
    icon: <Flag className="w-5 h-5" />,
    title: 'Reporting Profiles',
    description: 'Report profiles that violate our policies',
    color: 'text-red-600 bg-red-50 border-red-200',
    articles: [
      { id: 'rp-1', title: 'How do I report a profile?', tags: ['report', 'flag', 'abuse', 'profile'],
        body: 'If you see a Profile Centre that violates our policies, you can report it directly from the profile page.\n\nTo report a profile:\n1. Visit the public profile page\n2. Scroll to the bottom of the page — or use the "Report" button fixed to the bottom-right corner of the page\n3. Click "Report this profile" or "Report this business"\n4. Enter your name and email address\n5. Select a reason for your report\n6. Provide details about the issue\n7. Submit\n\nReport reasons include: spam or scam, impersonation, harassment or abuse, illegal content, adult or unsafe content, misleading information, privacy issue, intellectual property issue, and other.\n\nYour report is reviewed by the Profile Centre moderation team. We will take appropriate action in line with our Reporting and Moderation Policy.\n\nUK GDPR notice: Your name and email are used only to process the report and contact you if needed. We will not share your details with the profile owner.' },
      { id: 'rp-2', title: 'What happens after I report a profile?', tags: ['report', 'moderation', 'review'],
        body: 'After you submit a report, the Profile Centre moderation team reviews it.\n\nPossible outcomes include:\n• No action (if the report does not identify a policy violation)\n• Warning issued to the profile owner\n• Profile temporarily hidden pending investigation\n• Profile suspended (unpublished and locked)\n• Profile permanently removed\n• Account suspended or terminated\n• Report to authorities (for illegal content or threats)\n\nWe aim to review all reports within 5 working days. For urgent matters (threats, illegal content), contact support directly.\n\nFalse reports: Submitting false or malicious reports may result in action against your own account.' },
    ],
  },
  {
    id: 'install-app',
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Install as an App',
    description: 'Add Profile Centre to your home screen or desktop — no app store needed',
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    articles: [
      { id: 'ia-1', title: 'What is a web app and why install it?', tags: ['install', 'pwa', 'web app', 'home screen'],
        body: 'Profile Centre is a Progressive Web App (PWA). You can install it directly from your browser — no App Store or Google Play required.\n\nBenefits:\n• Appears on your home screen or desktop like a native app\n• Opens in its own window without the browser address bar\n• Loads faster after the first visit\n• Works offline for basic navigation\n• Updates automatically — always the latest version\n\nSupported on: iOS Safari, Android Chrome, Android Samsung Internet, desktop Chrome, desktop Edge, and desktop Safari (macOS Sonoma+).' },
      { id: 'ia-2', title: 'Install on iPhone or iPad (iOS Safari)', tags: ['ios', 'iphone', 'ipad', 'safari', 'install', 'apple'],
        body: 'iOS only supports PWA installation through Safari. Chrome and Firefox on iOS do not support this.\n\nSteps:\n1. Open Profile Centre in Safari on your iPhone or iPad\n2. Tap the Share button (box with arrow pointing up) at the bottom of the screen\n3. Scroll down and tap "Add to Home Screen"\n4. Edit the name if you like, then tap "Add"\n\nThe icon will appear on your home screen. Tap it to open in full-screen mode.\n\nTip: If you don\'t see "Add to Home Screen", make sure you are using Safari and not another browser.' },
      { id: 'ia-3', title: 'Install on Android (Chrome or Samsung Internet)', tags: ['android', 'chrome', 'samsung', 'install', 'home screen'],
        body: 'Using Chrome:\n1. Open Profile Centre in Chrome on your Android device\n2. A banner may appear at the bottom — tap "Add"\n3. If not, tap the three-dot menu (⋮) → "Add to Home screen" or "Install app"\n4. Tap "Add" or "Install" to confirm\n\nUsing Samsung Internet:\n1. Open Profile Centre in Samsung Internet\n2. Tap the menu icon (three lines) at the bottom\n3. Tap "Add page to" → "Home screen" → "Add"\n\nThe icon will appear on your home screen and open in full-screen mode.' },
      { id: 'ia-4', title: 'Install on desktop (Chrome or Edge)', tags: ['desktop', 'chrome', 'edge', 'windows', 'mac', 'install'],
        body: 'Using Chrome:\n1. Open Profile Centre in Google Chrome\n2. Look for the install icon (computer with down arrow) in the address bar\n3. Click it and then click "Install"\n4. Or: three-dot menu → "Cast, save, and share" → "Install page as app"\n\nUsing Microsoft Edge:\n1. Open Profile Centre in Edge\n2. Three-dot menu (…) → "Apps" → "Install this site as an app"\n3. Click "Install"\n\nOnce installed, Profile Centre opens in its own window. Find it in your Start Menu (Windows) or Applications folder (Mac).' },
      { id: 'ia-5', title: 'Install on Mac (Safari)', tags: ['mac', 'safari', 'macos', 'desktop', 'install'],
        body: 'Safari on macOS Sonoma (14) and later supports adding web apps to your Dock.\n\nSteps:\n1. Open Profile Centre in Safari on your Mac\n2. Click "File" in the menu bar\n3. Click "Add to Dock…"\n4. Edit the name if you like, then click "Add"\n\nProfile Centre will appear in your Dock and launch like any other app.\n\nRequires macOS Sonoma (14) or later. For earlier macOS, use Chrome or Edge instead.' },
      { id: 'ia-6', title: 'How do I remove the app from my device?', tags: ['uninstall', 'remove', 'delete', 'home screen'],
        body: 'Removing the app does not affect your account or data.\n\niPhone/iPad: Press and hold the icon → "Remove App" → "Delete from Home Screen"\n\nAndroid: Press and hold the icon → drag to "Remove" or "Uninstall"\n\nDesktop Chrome: Open the app → three-dot menu → "Uninstall Profile Centre"\n\nDesktop Edge: Open the app → three-dot menu → "App settings" → "Uninstall"\n\nMac Dock: Right-click the icon → "Remove from Dock"\n\nYou can reinstall at any time by visiting the site and following the install steps again.' },
    ],
  },
];

export default function PublicHelpCentrePage() {
  const branding = useBranding();
  const [query, setQuery] = useState('');
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      articles: cat.articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.tags.some(t => t.includes(q))
      ),
    })).filter(cat => cat.articles.length > 0);
  }, [query]);

  return (
    <>
      <Helmet>
        <title>{`Help Centre — ${branding.platform_name}`}</title>
        <meta name="description" content="Help Centre for Profile Centre. Find answers to common questions about your account, profiles, billing, privacy and more." />
        <link rel="canonical" href={`${APP_URL}/help`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Help Centre — ${branding.platform_name}`} />
        <meta property="og:description" content="Find answers to common questions about Profile Centre." />
        <meta property="og:url" content={`${APP_URL}/help`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <HelpCircle className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Help Centre</h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Find answers to common questions about Profile Centre. No login required.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto mb-12">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="pl-10 h-11 rounded-xl"
          />
        </div>

        {/* Categories */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No articles found for "{query}"</p>
            <p className="text-sm mt-1">Try a different search term or browse the categories below.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map(cat => (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">{cat.title}</h2>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <div className="space-y-2 ml-12">
                  {cat.articles.map(article => (
                    <div key={article.id} className="border border-border rounded-xl overflow-hidden bg-card">
                      <button
                        onClick={() => setOpenArticle(openArticle === article.id ? null : article.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground">{article.title}</span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${openArticle === article.id ? 'rotate-180' : ''}`} />
                      </button>
                      {openArticle === article.id && (
                        <div className="px-4 pb-4 border-t border-border">
                          <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed pt-3">
                            {article.body}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 p-6 rounded-2xl bg-muted/40 border border-border text-center">
          <p className="font-semibold text-foreground mb-1">Still need help?</p>
          <p className="text-sm text-muted-foreground mb-4">
            Contact us at{' '}
            <a href={`mailto:${branding.support_email}`} className="text-primary hover:underline">{branding.support_email}</a>.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/login">
              <Button variant="outline" size="sm" className="gap-2">
                <User className="w-4 h-4" /> Sign in for account help
              </Button>
            </Link>
            <Link to="/report-issue">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" /> Report an issue
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
