/**
 * Dashboard — Help Centre
 * /dashboard/help-centre
 *
 * Auth-gated visual help centre. Covers every feature the platform offers.
 * Organised into categories with expandable articles, a search bar, and
 * quick-action cards for the most common support needs.
 */
import { useState, useMemo, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Search, ChevronDown, ChevronRight, BookOpen, User, Link2,
  CreditCard, MessageCircle, Shield, BarChart3, Bell, Settings,
  HelpCircle, Zap, AlertCircle, CheckCircle2,
  QrCode, Mail, Users, FileText,
  Palette, Building2, Sparkles, RefreshCw, Smartphone,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

// ─── Content ──────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

interface Category {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  articles: Article[];
}

const CATEGORIES: Category[] = [
  {
    id: 'getting-started',
    icon: <Zap className="w-5 h-5" />,
    title: 'Getting Started',
    description: 'Set up your account and create your first profile',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    articles: [
      {
        id: 'gs-1',
        title: 'Creating your account',
        tags: ['account', 'signup', 'login'],
        body: `Your Profile Centre account is created automatically when you sign in for the first time using your **JA Group Services ID**.\n\nJA Group Services ID is the identity and access management system operated by JA Group Services Ltd. It is the same login you use across other JA Group Services products. No separate registration is needed — your Profile Centre account is created automatically on first sign-in.\n\n**Steps to get started:**\n1. Click "Sign In" on the homepage\n2. You will be redirected to JA Group Services ID to authenticate securely\n3. Once authenticated, your account is created and you land on your dashboard\n4. You can immediately start creating your first profile\n\nIf you have trouble signing in, make sure you are using the correct JA Group Services ID credentials. The terms and privacy policy for JA Group Services ID are available at jagroupservices.co.uk. Contact support if the issue persists.`,
      },
      {
        id: 'gs-2',
        title: 'Understanding your dashboard',
        tags: ['dashboard', 'overview', 'navigation'],
        body: `Your dashboard is your control centre. The sections you see depend on your plan — higher plans unlock more features.\n\n**Always available (all plans, including Free):**\n- **Overview** — A summary of your profiles, recent activity, stats, and quick actions\n- **Personal Profile** — Create and manage your personal digital business card (editor always available; features limited on Free)\n- **Themes** — Customise the visual appearance of your public profile (basic themes on Free)\n- **My Account** — Update your account details and preferences\n- **Plans & Billing** — Manage your subscription plan and payment details\n- **Support Tickets** — Raise and track support requests with the Profile Centre team\n- **Help Centre** — This page\n- **Security** — Manage your account security settings\n- **Data & Privacy** — Submit GDPR data requests (SAR, deletion, correction, portability)\n- **Notification Preferences** — Control which notifications you receive\n\n**Starter plan and above:**\n- **Links Manager** — Add social media, contact, booking, and custom links. Supports 35+ platforms\n- **WhatsApp Button** — Add a WhatsApp click-to-chat button to your profile\n- **Gallery** — Showcase images of your work, products, or portfolio\n- **Menu / Price List** — Display a menu, price list, or service catalogue on your profile\n- **PDF Attachments** — Attach downloadable PDFs (brochures, CVs, menus) to your profile\n- **Social Links Setup** — Manage your social media profile links displayed as branded icons\n- **QR Code** — Download a QR code for your profile for printed materials and presentations\n- **Profile Poster** — Export your profile as an A4 PDF poster\n- **Contact Enquiries** — Receive and manage contact messages from profile visitors\n- **Email Signature** — Build a professional email signature that links to your profile\n- **Business Cards** — Request professionally printed business cards connected to your profile\n\n**Professional plan and above:**\n- **Organisation Profile** — Full organisation page editor with services, team, gallery, testimonials, FAQs, opening hours, and more\n- **Analytics** — See how many people have viewed your profiles and clicked your links\n\n**Organisation plan and above:**\n- **Organisation Seats** — Invite and manage team members on your organisation profile`,
      },
      {
        id: 'gs-3',
        title: 'Free plan and trial limits',
        tags: ['trial', 'plan', 'limits', 'upgrade', 'free'],
        body: `**Free plan** — always free, no expiry, no credit card required.\n\nThe Free plan includes:\n- 1 personal profile page\n- Access to the full profile editor (name, photo, bio, contact details, skills, experience, education, etc.)\n- 1 link\n- QR code (sharing only — download requires Starter or above)\n- Basic themes\n- Profile Centre branding shown on your profile (cannot be removed on Free)\n\n**What is NOT available on the Free plan:**\n- Links Manager beyond 1 link\n- WhatsApp Button\n- Gallery\n- Menu / Price List\n- PDF Attachments\n- QR code download\n- Analytics\n- Contact Enquiries / contact form\n- Profile Poster\n- Business Cards\n- Email Signature\n- Organisation / Business Profile\n- Organisation Seats\n- Remove branding\n- Premium themes\n\n**Plan tiers:**\n- **Free** — 1 personal profile, 1 link, basic themes, profile editor access\n- **Starter** — 1 personal profile, 20 links, WhatsApp Button, Gallery, Menu/Price List, PDF Attachments, Social Links, QR download, Profile Poster, Contact Enquiries, Email Signature, premium themes. No organisation profile.\n- **Professional** — 1 personal profile + 1 organisation profile, unlimited links, analytics, remove branding\n- **Organisation** — 1 personal profile + 1 organisation profile, up to 20 team seats\n- **Ultimate Organisation** — 1 personal profile + up to 4 organisation profiles, up to 20 team seats\n- **Ultimate Organisation+** — 1 personal profile + up to 10 organisation profiles, up to 40 team seats (contact us for pricing)\n- **Lifetime** — All features, unlimited profiles and links, no monthly fee\n\n**Free trial** — New accounts can start a 30-day free trial. No credit card required. All features are available during the trial.\n\n**After your trial ends:**\n- You have 7 days to select a plan\n- Your data is preserved — nothing is deleted\n- You can still access your billing page to subscribe\n- If you do not subscribe, your account reverts to the Free plan\n\n**Business Cards** are a separate paid service and are not included in any plan. See the Business Cards section for details.`,
      },
      {
        id: 'gs-4',
        title: 'What is a Profile Centre?',
        tags: ['what is', 'profile centre', 'digital card', 'overview'],
        body: `A Profile Centre is your digital business card — a professional online profile that you can share with anyone via a link or QR code.\n\n**Instead of handing out a paper business card, you share your Profile Centre link.** When someone opens it, they see your name, photo, contact details, social links, and any other information you choose to include.\n\n**Key benefits:**\n- Always up to date — change your details any time and everyone who has your link sees the latest version\n- Works on any device — no app required for the person viewing it\n- Trackable — see how many people viewed your profile and clicked your links\n- Shareable — via link or QR code\n- Professional — looks great on mobile and desktop\n\n**Two profile types:**\n- **Personal Profile** — for individuals: your name, photo, job title, bio, skills, experience, contact links, WhatsApp button, gallery, menu, PDFs, and social links\n- **Organisation Profile** — for companies and brands: organisation name, logo, services, team, gallery, testimonials, opening hours, FAQs, and more`,
      },
    ],
  },
  {
    id: 'profiles',
    icon: <User className="w-5 h-5" />,
    title: 'Personal Profile',
    description: 'Create, edit, and manage your personal digital business card',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    articles: [
      {
        id: 'p-1',
        title: 'Creating your personal profile',
        tags: ['profile', 'create', 'new', 'personal'],
        body: `Your personal profile is your digital business card — it shows your name, photo, job title, bio, skills, experience, and contact links.\n\n**To create your profile:**\n1. Go to Dashboard → Personal Profile\n2. Click "Create Profile" if you have not created one yet\n3. Choose your profile type (see below)\n4. Fill in your details\n5. Click Save\n\nYour profile starts in draft mode (unpublished). You can continue editing before making it public.\n\n**Personal profile types:**\n- **Professional** — General professional profile for any industry\n- **Job Seeker** — Highlights your CV, skills, and experience for recruiters\n- **Content Creator** — Showcases your content channels and platforms\n- **Freelancer** — Highlights your services, portfolio, and availability\n- **Consultant** — Focuses on your expertise, services, and booking\n- **Artist / Creative** — Gallery-forward profile for visual creatives\n- **Speaker** — Showcases your speaking topics, events, and booking\n- **Coach** — Highlights your coaching services and client results\n- **Portfolio** — Project and work showcase\n- **Personal Brand** — Flexible profile for building your personal brand\n- **Other** — Flexible layout for any other use case\n\n**Note:** Your personal profile can be used by professionals, business owners, freelancers, and anyone who wants a digital card. It is not limited to employees — business owners can use it alongside their Organisation Profile.`,
      },
      {
        id: 'p-2',
        title: 'Publishing and unpublishing your profile',
        tags: ['publish', 'unpublish', 'visibility', 'public', 'live'],
        body: `A profile must be published before it can be viewed by the public.\n\n**To publish your profile:**\n1. Open your profile in the dashboard\n2. Toggle the "Published" switch to On\n3. Your profile is now live at its public URL\n\n**To unpublish:**\n- Toggle the switch back to Off\n- The profile URL will return a "not found" page until you republish\n- Your data is not deleted\n\n**Note:** If your plan does not allow multiple profiles, you may need to unpublish one before publishing another.`,
      },
      {
        id: 'p-3',
        title: 'Customising your profile URL',
        tags: ['url', 'username', 'slug', 'custom', 'link'],
        body: `Your profile URL is based on your username, which you set when creating the profile.\n\n**Format:** japrofilestudio.jagroupservices.co.uk/[username]\n\n**Rules for usernames:**\n- Must be unique across the platform\n- Can contain letters, numbers, and hyphens\n- Cannot start or end with a hyphen\n- Minimum 3 characters, maximum 30\n\n**To change your username:**\n1. Open the profile editor\n2. Find the "Username / URL" field\n3. Enter your new username\n4. Save the profile\n\n**Important:** Changing your username changes your public URL. Any existing links or QR codes pointing to the old URL will stop working. Update your QR code and any shared links after changing your username.`,
      },
      {
        id: 'p-4',
        title: 'Profile sections — what you can add',
        tags: ['sections', 'bio', 'skills', 'experience', 'education', 'certifications', 'awards'],
        body: `Your personal profile supports a rich set of sections. You can show or hide each section depending on your profile type.\n\n**Core sections:**\n- **Photo & cover** — Profile photo and cover/banner image\n- **Name, title & company** — Your display name, job title, and employer\n- **Bio / About** — A short description about yourself\n- **Contact details** — Email, phone, website\n- **Home / Location** — Your city or region (shown publicly if enabled)\n- **Business Address** — Your office or business address (optional, for professionals and business owners)\n\n**Professional sections:**\n- **Skills** — Tag-style chips for your key skills\n- **Languages** — Languages you speak\n- **Experience** — Work history with title, company, period, and description\n- **Education** — Degrees, courses, and qualifications\n- **Certifications** — Professional certifications with issuer and year\n- **Awards** — Achievements and recognition\n\n**New feature sections (Starter+):**\n- **WhatsApp Button** — A click-to-chat WhatsApp button on your profile\n- **Gallery** — Showcase images of your work or portfolio\n- **Menu / Price List** — Display your services, prices, or menu\n- **PDF Attachments** — Downloadable PDFs (brochures, CVs, menus)\n- **Social Links** — Branded social media icon links\n\n**Design sections:**\n- **Profile type** — Changes the layout and section suggestions\n- **Layout preset** — How sections are arranged on the page\n- **Colour palette** — Brand colours for your profile\n- **Button style** — Rounded, sharp, outlined, etc.\n\n**Privacy sections:**\n- **PIN protection** — Require a PIN to view your profile\n- **Contact form toggle** — Turn the contact form on or off`,
      },
      {
        id: 'p-5',
        title: 'PIN protection for your profile',
        tags: ['pin', 'password', 'protect', 'private', 'security'],
        body: `You can add a PIN to your profile to restrict who can view it.\n\n**To enable a PIN:**\n1. Open the profile editor\n2. Scroll to the "Security" section\n3. Enable "PIN Protection"\n4. Set a 4–6 digit PIN\n5. Save\n\nVisitors will be asked to enter the PIN before they can view your profile. This is useful for profiles you only want to share with specific people.\n\n**Important:** The PIN is not a substitute for keeping sensitive information off your profile. Anyone who knows the PIN can view the profile.`,
      },
      {
        id: 'p-6',
        title: 'Exporting your profile as a PDF poster',
        tags: ['poster', 'pdf', 'export', 'a4', 'share', 'download'],
        body: `You can generate an A4 PDF poster of your personal profile to share digitally — as an email attachment, in a presentation, or on a website.\n\n**This is not a printed business card.** For physically printed cards, use Dashboard → Business Cards.\n\n**To generate a poster:**\n1. Go to Dashboard → Personal Profile\n2. Scroll to the "Export" section, or go to Dashboard → Profile Poster\n3. Choose your orientation — Portrait or Landscape\n4. Select one of the 4 design templates\n5. Click "Open Poster PDF"\n6. The PDF opens in a new browser tab — save with Ctrl+S (or Cmd+S on Mac)\n\n**Available on:** Starter, Professional, and Organisation plans. Not available on the Free plan.`,
      },
    ],
  },
  {
    id: 'organisation-profile',
    icon: <Building2 className="w-5 h-5" />,
    title: 'Organisation Profile',
    description: 'Set up and manage your organisation profile with services, team, and more',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    articles: [
      {
        id: 'bp-1',
        title: 'Creating your organisation page',
        tags: ['organisation', 'profile', 'company', 'brand', 'create'],
        body: `An organisation profile is designed for companies, agencies, and brands. It includes rich sections for organisation information, services, team, gallery, testimonials, FAQs, and more.\n\n**To create an organisation profile:**\n1. Go to Dashboard → Organisation Profile\n2. Click "Set Up Organisation Profile"\n3. Choose your organisation type (see below)\n4. Fill in your organisation details\n5. Save and publish\n\n**Organisation types:**\n- Local Service Business (plumber, cleaner, handyman, etc.)\n- Consultant\n- Freelancer\n- Tradesperson (builder, carpenter, electrician, etc.)\n- Restaurant / Café\n- Barber / Salon\n- Beauty / Wellness\n- Healthcare / Clinic\n- Real Estate / Property\n- Retail / Shop\n- Education / Training\n- Event / Wedding Business\n- Creative Agency\n- Technology / SaaS\n- Non-profit / Community\n- Other\n\nEach organisation type suggests the most relevant sections for your industry.`,
      },
      {
        id: 'bp-2',
        title: 'Organisation page sections — what you can add',
        tags: ['sections', 'services', 'team', 'gallery', 'hours', 'faqs', 'testimonials', 'announcements'],
        body: `Your organisation page supports a comprehensive set of sections. Each section can be shown or hidden.\n\n**Core sections:**\n- **Organisation name, tagline & description** — Your brand identity\n- **Logo & cover image** — Visual branding\n- **Contact details** — Organisation email, phone, website\n- **Location / address** — Physical address or service area\n- **Organisation type & category** — Helps visitors understand what you do\n\n**Content sections:**\n- **Services / Products** — List what you offer with name, description, price, and category\n- **Team members** — Show your team with name, role, bio, photo, email, and LinkedIn\n- **Gallery** — Photo and video gallery of your work\n- **Testimonials** — Customer reviews with name, role, rating, and quote\n- **Awards & certifications** — Credentials and recognition\n- **FAQs** — Frequently asked questions with answers\n- **Announcements** — News, offers, and updates\n\n**Operational sections:**\n- **Opening hours** — Day-by-day hours with open/closed toggle\n- **Payment methods** — What payment types you accept\n- **Social links** — Your organisation social media profiles\n\n**Conversion sections:**\n- **CTA buttons** — Custom call-to-action buttons (Book Now, Get a Quote, etc.)\n- **Booking link** — Direct link to your booking system\n- **Map** — Embedded map showing your location\n\n**Design sections:**\n- **Organisation type** — Changes layout and section suggestions\n- **Colour palette** — Brand colours\n- **Layout preset** — How sections are arranged\n- **Button style** — Rounded, sharp, outlined, etc.`,
      },
      {
        id: 'bp-3',
        title: 'Adding services to your organisation page',
        tags: ['services', 'products', 'pricing', 'add', 'list'],
        body: `The Services section lets you list what your organisation offers, with optional pricing.\n\n**To add a service:**\n1. Go to Dashboard → Organisation Profile\n2. Scroll to the "Services / Products" section\n3. Click "Add Service"\n4. Enter the service name, description, price (optional), and category\n5. Save\n\n**Tips:**\n- Use categories to group related services (e.g. "Haircuts", "Colour", "Treatments")\n- Leave the price blank if pricing varies or is available on request\n- Keep descriptions concise — 1–2 sentences is usually enough\n- Add your most popular or flagship services first`,
      },
      {
        id: 'bp-4',
        title: 'Adding team members',
        tags: ['team', 'staff', 'members', 'directory', 'add'],
        body: `The Team section shows your team publicly on your organisation profile.\n\n**To add a team member:**\n1. Go to Dashboard → Organisation Profile\n2. Scroll to the "Team Members" section\n3. Click "Add Team Member"\n4. Enter their name, role, bio, photo URL, email, and LinkedIn\n5. Save\n\n**Note:** This is different from Organisation Seats. Team members in this section are displayed publicly on your profile. Organisation Seats are for giving team members access to your dashboard.\n\n**Photo:** Enter a direct URL to a photo (e.g. from your website or a public image host). The photo is displayed as a circular avatar on your profile.`,
      },
      {
        id: 'bp-5',
        title: 'Setting opening hours',
        tags: ['hours', 'opening', 'times', 'schedule', 'closed'],
        body: `The Opening Hours section shows your organisation hours publicly on your profile.\n\n**To set your hours:**\n1. Go to Dashboard → Organisation Profile\n2. Scroll to the "Opening Hours" section\n3. Toggle each day on or off (closed days show "Closed")\n4. Set the opening and closing time for each open day\n5. Save\n\n**Tips:**\n- Use the "Closed" toggle for days you do not operate\n- If your hours vary seasonally, update them when they change\n- Consider adding a note in your description if your hours are irregular`,
      },
      {
        id: 'bp-6',
        title: 'Adding testimonials and reviews',
        tags: ['testimonials', 'reviews', 'ratings', 'customers', 'social proof'],
        body: `The Testimonials section lets you showcase customer reviews directly on your organisation profile.\n\n**To add a testimonial:**\n1. Go to Dashboard → Organisation Profile\n2. Scroll to the "Testimonials" section\n3. Click "Add Testimonial"\n4. Enter the customer name, role/company, their quote, and a star rating (1–5)\n5. Save\n\n**Tips:**\n- Ask satisfied customers for a short quote you can add\n- Include their role or company for credibility\n- 3–5 testimonials is usually enough — quality over quantity\n- Keep quotes concise and specific to the value you provided`,
      },
    ],
  },
  {
    id: 'links',
    icon: <Link2 className="w-5 h-5" />,
    title: 'Links',
    description: 'Add and manage links on your profiles — 35+ platforms supported',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    articles: [
      {
        id: 'l-1',
        title: 'Adding links to your profile',
        tags: ['links', 'social', 'add', 'url', 'platform'],
        body: `Links appear on your public profile and let visitors connect with you across platforms.\n\n**To add a link:**\n1. Go to Dashboard → Links\n2. Click "Add Link"\n3. Choose "Platform / Social" to pick from 35+ supported platforms, or "Custom URL" for any other link\n4. If using Platform / Social, browse by category and click the platform you want\n5. Enter the URL and label\n6. Click "Add Link"\n\n**Platform categories:**\n- **Social Media** — Instagram, Facebook, Twitter/X, TikTok, Threads, Snapchat, Pinterest\n- **Professional** — LinkedIn, GitHub, Behance, Dribbble, Medium, Substack\n- **Contact & Messaging** — Email, Phone, WhatsApp, Telegram, Signal\n- **Creative & Portfolio** — Website, Portfolio, Linktree, Etsy\n- **Music & Podcasts** — Spotify, SoundCloud, Apple Music, Podcast\n- **Shopping & Commerce** — Shopify, Amazon, PayPal.me, Stripe Payment\n- **Booking & Scheduling** — Calendly, Booking Page, Google Maps\n- **Video & Streaming** — YouTube, Twitch, Vimeo\n- **Other** — Any custom URL\n\n**Custom links** let you add any URL with a custom label — useful for portfolios, booking pages, or any other destination.`,
      },
      {
        id: 'l-2',
        title: 'Contact and messaging links',
        tags: ['email', 'phone', 'whatsapp', 'contact', 'tel', 'mailto'],
        body: `Contact links use special URL formats so they open the right app on the visitor's device.\n\n**Email link:**\n- Use the format: mailto:you@example.com\n- When clicked, opens the visitor's email app with your address pre-filled\n- Example: mailto:hello@mybusiness.co.uk\n\n**Phone link:**\n- Use the format: tel:+441234567890\n- When clicked on mobile, opens the phone dialler\n- Always include the country code (e.g. +44 for UK)\n- No spaces, brackets, or dashes\n- Example: tel:+447700900000\n\n**WhatsApp link:**\n- Use the format: https://wa.me/447700900000\n- Replace with your number including country code, no + or spaces\n- When clicked, opens WhatsApp with a chat to your number\n- Example: https://wa.me/447700900000\n\n**Telegram:**\n- Use the format: https://t.me/yourhandle\n\n**Signal:**\n- Use the format: https://signal.me/#p/yourhandle`,
      },
      {
        id: 'l-3',
        title: 'Booking and scheduling links',
        tags: ['booking', 'calendly', 'schedule', 'appointment', 'calendar'],
        body: `Booking links let visitors book time with you directly from your profile.\n\n**Calendly:**\n- Create a free account at calendly.com\n- Copy your Calendly link (e.g. https://calendly.com/yourname)\n- Add it as a Calendly link in Dashboard → Links\n\n**Other booking systems:**\n- Use the "Booking Page" platform type for any booking system URL\n- Works with Acuity, SimplyBook, Booksy, Fresha, and any other booking tool\n- Just paste the full URL to your booking page\n\n**Google Maps:**\n- Add your Google Maps location link so visitors can get directions\n- Find your business on Google Maps, click Share, and copy the link\n- Add it as a Google Maps link in Dashboard → Links`,
      },
      {
        id: 'l-4',
        title: 'Reordering and managing links',
        tags: ['reorder', 'sort', 'order', 'enable', 'disable', 'delete'],
        body: `**Reordering links:**\nLinks appear on your profile in the order shown in your dashboard. Use the up/down arrows on the left of each link to change the order.\n\n**Enabling and disabling links:**\nToggle the switch next to any link to show or hide it from your public profile without deleting it. Useful for seasonal links or links that are temporarily unavailable.\n\n**Editing links:**\nClick the pencil icon to edit the label or URL of any link.\n\n**Deleting links:**\nClick the bin icon to permanently delete a link. This cannot be undone.\n\n**Plan limits:**\nThe number of links you can add depends on your plan. Your current usage is shown at the top of the Links page. Upgrade your plan to add more links.`,
      },
    ],
  },
  {
    id: 'enquiries',
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'Contact Enquiries',
    description: 'Receive and manage contact enquiries from profile visitors',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    articles: [
      {
        id: 'e-1',
        title: 'How contact enquiries work',
        tags: ['enquiry', 'contact', 'visitors', 'how', 'form'],
        body: `Contact enquiries allow visitors to your profile to send you a message without needing your email address.\n\n**How it works:**\n1. A visitor fills in the contact form on your public profile\n2. You receive a notification in your dashboard\n3. You can view the enquiry in Dashboard → Enquiries\n4. Reply directly to the visitor by email\n\n**Contact enquiries are one-way.** Visitors submit a message and you respond by email. There is no two-way messaging thread.\n\n**Enabling the contact form:**\n- Open your profile editor\n- Find the "Contact form" toggle\n- Turn it On or Off\n- Save the profile\n\nWhen the contact form is off, visitors cannot send you enquiries through your public profile.`,
      },
      {
        id: 'e-2',
        title: 'Reporting abusive enquiries',
        tags: ['report', 'abuse', 'spam', 'block'],
        body: `If you receive an abusive, threatening, or spam enquiry, you can report it to the platform admin team.\n\n**To report an enquiry:**\n1. Open the enquiry in Dashboard → Enquiries\n2. Use the report option\n3. The enquiry is flagged for admin review\n\n**Admin review:** Reported enquiries are reviewed by the platform admin team. Serious cases may result in the sender being blocked platform-wide.`,
      },
    ],
  },
  {
    id: 'qr-codes',
    icon: <QrCode className="w-5 h-5" />,
    title: 'QR Codes',
    description: 'Generate and download QR codes for your profiles',
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    articles: [
      {
        id: 'qr-1',
        title: 'Generating and downloading a QR code',
        tags: ['qr', 'code', 'download', 'print', 'generate'],
        body: `Every profile has a QR code that links directly to its public URL. You can download and print it for business cards, posters, or any physical material.\n\n**To generate a QR code:**\n1. Go to Dashboard → QR Code\n2. Select the profile you want a QR code for\n3. Choose your preferred style and colour\n4. Click "Download"\n5. The QR code is downloaded as a PNG or SVG file\n\n**Tips for printing:**\n- Use the SVG format for the best quality at any size\n- Test the QR code with your phone before printing\n- Ensure there is enough white space (quiet zone) around the code\n- Minimum recommended print size: 2cm × 2cm\n\n**Plan availability:** QR code downloads are available on Starter and higher plans. Free plan users can share their QR code but cannot download it.`,
      },
      {
        id: 'qr-2',
        title: 'Using your QR code',
        tags: ['qr', 'use', 'print', 'share'],
        body: `Your QR code can be used anywhere you want to share your profile.\n\n**Common uses:**\n- Print on business cards\n- Add to email signatures\n- Display on a desk stand or reception area\n- Include in presentations and slide decks\n- Add to invoices and proposals\n- Display on a shop window or notice board\n- Include in printed marketing materials\n- Add to your website\n\n**Updating your QR code:** Your QR code always points to your profile URL. If you change your username, you will need to download a new QR code as the old one will stop working.`,
      },
    ],
  },
  {
    id: 'analytics',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Analytics',
    description: 'Understand your profile views and link click data',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    articles: [
      {
        id: 'a-1',
        title: 'What analytics data is collected',
        tags: ['analytics', 'data', 'privacy', 'tracking', 'views', 'clicks'],
        body: `When someone views your profile or clicks a link, we record anonymised analytics data.\n\n**Data collected per profile view:**\n- Timestamp\n- Approximate location (country/city, derived from IP)\n- Device type (mobile, desktop, tablet)\n- Referrer (where they came from)\n- The visitor's IP address (stored internally, not shown to you)\n\n**Data collected per link click:**\n- Which link was clicked\n- Timestamp\n- Device type\n\n**What we do NOT collect:**\n- Personal identity of visitors\n- Cookies or persistent tracking\n- Behaviour after leaving your profile\n\nAll analytics data is held in accordance with our Privacy Policy and UK GDPR.`,
      },
      {
        id: 'a-2',
        title: 'Reading your analytics dashboard',
        tags: ['analytics', 'dashboard', 'stats', 'views', 'ctr'],
        body: `Your analytics dashboard shows you how your profiles are performing.\n\n**Key metrics:**\n- **Total views** — How many times your profile has been viewed\n- **Views this month** — Views in the current calendar month\n- **Link clicks** — Total clicks across all your links\n- **Click-through rate (CTR)** — Percentage of visitors who clicked at least one link\n\n**Charts available:**\n- Views over time (daily/weekly)\n- Top performing links\n- Device breakdown (mobile vs desktop)\n- Geographic breakdown (where your visitors are from)\n\n**Advanced analytics** are available on plans that include the advanced analytics feature. Basic view and click counts are available on all plans.`,
      },
    ],
  },
  {
    id: 'themes',
    icon: <Palette className="w-5 h-5" />,
    title: 'Themes & Customisation',
    description: 'Personalise the look of your profiles',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    articles: [
      {
        id: 't-1',
        title: 'Applying a theme to your profile',
        tags: ['theme', 'colour', 'design', 'customise', 'appearance'],
        body: `Themes change the visual appearance of your public profile — colours, fonts, and layout style.\n\n**To apply a theme:**\n1. Go to Dashboard → Themes\n2. Browse the available themes\n3. Click "Preview" to see how it looks on your profile\n4. Click "Apply" to activate it\n\n**Theme availability** depends on your plan. Free plans have access to a limited set of themes. Paid plans unlock the full theme library including premium themes.\n\n**Advanced no-code customisation:** Use the profile type selector and design options inside your profile builder (Personal Profile or Organisation Profile) to choose layout presets, colour palettes, button styles, and section ordering — all without any coding.`,
      },
      {
        id: 't-2',
        title: 'Colour palettes and layout presets',
        tags: ['colour', 'palette', 'layout', 'preset', 'design', 'style'],
        body: `Inside your profile editor (Personal Profile or Organisation Profile), you can customise the design without using the Themes page.\n\n**Colour palettes:**\n- Choose from a set of pre-built colour palettes\n- Each palette sets your profile's primary colour, background, and accent colours\n- Available in both your personal and organisation profile editors\n\n**Layout presets:**\n- Change how sections are arranged on your profile\n- Different presets suit different profile types (e.g. a portfolio layout vs a consultant layout)\n\n**Button styles:**\n- Choose how your link buttons look — rounded, sharp, outlined, filled, etc.\n\n**Section ordering:**\n- Drag sections up or down to change the order they appear on your public profile\n\nAll design changes are saved when you click Save in the profile editor.`,
      },
    ],
  },
  {
    id: 'billing',
    icon: <CreditCard className="w-5 h-5" />,
    title: 'Billing & Plans',
    description: 'Manage your subscription, payments, and plan features',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    articles: [
      {
        id: 'b-1',
        title: 'Subscribing to a plan',
        tags: ['subscribe', 'plan', 'payment', 'upgrade', 'stripe'],
        body: `To access all features after your trial, you need to subscribe to a paid plan.\n\n**To subscribe:**\n1. Go to Dashboard → Plans & Billing\n2. Browse the available plans\n3. Click "Subscribe" on the plan you want\n4. You will be redirected to our secure payment page (powered by Stripe)\n5. Enter your card details and confirm\n6. Your plan is activated immediately\n\n**Payment is processed securely by Stripe.** We never store your card details on our servers.\n\n**All plans are billed monthly.** You can cancel at any time — your access continues until the end of the billing period.\n\n**Business Cards** are a separate paid service. Payments for Business Cards are handled through Stripe invoices or Stripe payment links issued by admin — not through the plan subscription checkout.\n\n**Only pay using an official Stripe invoice or Stripe payment link issued by Profile Centre / JA Group Services Ltd.** Do not pay using any link that has not been issued through the official process.`,
      },
      {
        id: 'b-2',
        title: 'Cancelling your subscription',
        tags: ['cancel', 'subscription', 'refund', 'stop'],
        body: `You can cancel your subscription at any time from your dashboard.\n\n**To cancel:**\n1. Go to Dashboard → Plans & Billing\n2. Click "Cancel Subscription"\n3. Confirm the cancellation\n\n**What happens when you cancel:**\n- Your plan remains active until the end of the current billing period\n- You will not be charged again\n- After the period ends, your account reverts to a limited state\n- Your data is preserved — nothing is deleted\n\n**Refunds:** We do not offer refunds for partial billing periods. If you believe you have been charged in error, please contact support.`,
      },
      {
        id: 'b-4',
        title: 'Payment grace period',
        tags: ['grace', 'payment failed', 'overdue', 'billing', 'failed'],
        body: `If a subscription payment fails, your account enters a 7-day grace period.\n\n**During the grace period:**\n- A banner is shown in your dashboard with a countdown\n- The banner turns orange and then red as the deadline approaches\n- All your plan features remain active\n- You have 7 days to update your payment method and pay\n\n**If the grace period expires without payment:**\n- Your plan features are suspended\n- Your data is preserved\n- You can resubscribe at any time from the Plans & Billing page\n\n**To update your payment method:**\n1. Go to Dashboard → Plans & Billing\n2. Click "Update payment method"\n3. Enter your new card details through the Stripe portal`,
      },
      {
        id: 'b-5',
        title: 'Point of Sale — admin-managed payments',
        tags: ['pos', 'point of sale', 'payment link', 'invoice', 'collect payment', 'stripe checkout', 'custom payment'],
        body: `The Point of Sale (POS) feature is an admin-only tool used by the Profile Centre team to create secure Stripe Checkout payment links for custom amounts — for example, Business Card orders, custom invoices, or service fees.\n\n**As a customer, you do not need to use POS yourself.** When a payment is required (e.g. for a Business Card order), the admin team will send you an official Stripe invoice or Stripe payment link directly.\n\n**Only pay using an official Stripe invoice or Stripe payment link issued by Profile Centre / JA Group Services Ltd.** We will never ask for payment by bank transfer, cash, PayPal, or any other method.\n\nIf you have a question about a payment you have been asked to make, raise a support ticket or contact the team directly.`,
      },
    ],
  },
  {
    id: 'business-seats',
    icon: <Users className="w-5 h-5" />,
    title: 'Organisation Seats & Team',
    description: 'Invite and manage team members on your organisation profile',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    articles: [
      {
        id: 'bs-1',
        title: 'Inviting team members (seats)',
        tags: ['seats', 'team', 'invite', 'members', 'organisation'],
        body: `Organisation seats let you invite team members to access your organisation dashboard. Organisation Seats are available on the **Organisation plan** and above (not available on Professional, Starter, or Free).\n\n**To invite a team member:**\n1. Go to Dashboard → Organisation Seats\n2. Click "Invite Member"\n3. Enter their email address and name\n4. Select their role (Member or Admin)\n5. Click Send Invite\n\nThey will receive an email with a link to join your organisation profile. Once they accept, they can access the dashboard with the permissions you set.\n\n**Seat limits by plan:**\n- Organisation — up to 20 seats\n- Ultimate Organisation — up to 20 seats\n- Ultimate Organisation+ — up to 40 seats (contact us)\n\n**Removing a member:**\n1. Go to Dashboard → Organisation Seats\n2. Find the member\n3. Click "Remove"\n4. They are immediately removed from your profile\n\n**Note:** If you are on the Professional plan, you have an Organisation Profile but no Organisation Seats. Upgrade to Organisation to unlock seat invitations.`,
      },
      {
        id: 'bs-2',
        title: 'Seat permissions',
        tags: ['permissions', 'roles', 'admin', 'member', 'access'],
        body: `Each seat member has a role that controls what they can do in your dashboard.\n\n**Member role:**\n- Can view the organisation profile\n- Limited editing permissions (set by the organisation owner)\n\n**Admin role:**\n- Full access to the organisation dashboard\n- Can manage other seat members\n- Can edit all organisation profile sections\n\n**Note:** Seat members access your organisation dashboard — they do not have access to your personal profile, billing, or account settings.`,
      },
    ],
  },
  {
    id: 'business-cards',
    icon: <CreditCard className="w-5 h-5" />,
    title: 'Business Cards',
    description: 'Request professionally printed business cards connected to your Profile Centre',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    articles: [
      {
        id: 'bc-1',
        title: 'How the Business Cards service works',
        tags: ['business cards', 'print', 'order', 'request', 'how it works'],
        body: `Business Cards is a paid add-on service that lets you request professionally printed business cards connected to your Profile Centre.\n\n**Three ways to order:**\n- **Business Card Builder** — Use our online tool to choose a template, customise colours and layout, and add your details. A watermarked proof is shown before you submit.\n- **Upload Your Own Design** — Already have print-ready artwork? Upload your front and back files and we will arrange printing.\n- **Custom Design Request** — Need a design created from scratch? Submit a brief and our team will design your cards for you.\n\n**What happens after you submit:**\n1. Your request is reviewed and availability and pricing are checked\n2. The final price is confirmed and you are sent a Stripe invoice or payment link\n3. You pay using the official Stripe invoice or payment link\n4. Design or artwork work begins (if required)\n5. You review and approve a proof before printing\n6. Cards are ordered with the print provider and dispatched to you\n\n**Important:** Submitting a request does not place a confirmed order and does not start printing. No payment is taken until your request has been reviewed and you have been sent an official Stripe invoice or payment link.`,
      },
      {
        id: 'bc-2',
        title: 'Pricing and payment',
        tags: ['business cards', 'price', 'payment', 'stripe', 'cost', 'invoice'],
        body: `Business Cards are a paid add-on service. Pricing is confirmed after reviewing your request.\n\n**What the price may include:**\n- Provider print cost\n- Delivery cost\n- Artwork preparation fee (if your files need adjusting)\n- Logo placement fee\n- QR code setup fee\n- Premium finish cost (if applicable)\n- Design fee (for Custom Design requests)\n- Handling or service charge\n\n**Payment process:**\n1. Your request is reviewed and the full price breakdown is confirmed\n2. An official Stripe invoice or Stripe payment link is created\n3. You receive the invoice or link and pay securely through Stripe\n4. Payment is confirmed\n5. Work begins\n\n**Only pay using an official Stripe invoice or Stripe payment link issued by Profile Centre.** We will never ask for payment by bank transfer, cash, PayPal, or any other method.\n\n**Business Cards are not included in any Profile Centre plan.** Plan fees and Business Card charges are completely separate.`,
      },
      {
        id: 'bc-3',
        title: 'Understanding your request status',
        tags: ['status', 'progress', 'order status', 'track', 'where is my order'],
        body: `You can check the status of your Business Card request at any time from Dashboard → Business Cards → My Requests.\n\n**Status guide:**\n- **Submitted** — Your request has been received and is waiting for admin review\n- **Awaiting Admin Review** — Admin is reviewing your request\n- **File Review Required** — Admin needs to check your uploaded files\n- **Artwork Not Print-Ready** — Your files need adjustments before printing can proceed\n- **Artwork Approved for Proof** — Your artwork has been approved and a proof is being prepared\n- **Proof Sent** — A proof has been sent for your review and approval\n- **Changes Requested** — You have requested changes to the proof\n- **Design Deposit Required** — A deposit is required before custom design work begins\n- **Print Price Quoted** — Admin has confirmed the print price\n- **Stripe Invoice Sent** — An official Stripe invoice has been sent to you\n- **Payment Link Sent** — An official Stripe payment link has been sent to you\n- **Awaiting Payment** — Waiting for your payment\n- **Paid — Design Can Start** — Payment received, work is beginning\n- **Ready for Print** — Your cards are ready to be sent to the print provider\n- **Ordered with Provider** — Your cards have been ordered with the print provider\n- **In Production** — Your cards are being printed\n- **Dispatched** — Your cards have been dispatched\n- **Completed** — Your order is complete\n- **Cancelled / Rejected** — The request has been cancelled or rejected`,
      },
      {
        id: 'bc-4',
        title: 'Reviewing and approving your proof',
        tags: ['proof', 'approve', 'design', 'review', 'check'],
        body: `Before your cards are sent to print, you will be asked to review and approve a proof.\n\n**What to check carefully:**\n- Spelling of your name, title, company and all contact details\n- Phone number and email address are correct\n- Website URL is correct and working\n- QR code is present (if requested)\n- Logo is correct and not distorted\n- Colours look right on screen\n- Layout and spacing look as expected\n- Card size, finish and corner type are as requested\n- Quantity is correct\n\n**Before you approve:**\n- Check the proof on a large screen if possible\n- Print it out at actual card size (85mm × 55mm) to check readability\n- Ask a colleague to check for errors you might have missed\n\n**Once you approve:**\n- Your cards are ordered with the print provider\n- Changes are not possible after approval\n- Reprints due to errors you approved will be charged at full cost\n\n**If you spot an error:** Message the Profile Centre team via the message thread on your request before approving.`,
      },
    ],
  },
  {
    id: 'email-signature',
    icon: <Mail className="w-5 h-5" />,
    title: 'Email Signature',
    description: 'Create a professional email signature with your profile link',
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    articles: [
      {
        id: 'es-1',
        title: 'Creating your email signature',
        tags: ['email', 'signature', 'gmail', 'outlook', 'template'],
        body: `The Email Signature feature lets you create a professional email signature that includes your profile link, photo, contact details, and social links.\n\n**To create your signature:**\n1. Go to Dashboard → Email Signature\n2. Browse the template gallery — over 100 templates across 16 categories\n3. Click a template to preview it with your profile details\n4. Customise the layout and content as needed\n5. Click "Copy HTML" to copy the signature\n6. Paste it into your email client\n\n**Adding to Gmail:**\n1. Open Gmail → Settings (gear icon) → See all settings\n2. Go to the "General" tab\n3. Scroll to "Signature" and click "Create new"\n4. Give it a name, then paste the HTML into the editor\n5. Save changes\n\n**Adding to Outlook:**\n1. Open Outlook → File → Options → Mail → Signatures\n2. Click "New" and give it a name\n3. In the editor, paste the HTML (use the HTML source view if available)\n4. Click OK to save\n\n**Adding to Apple Mail:**\n1. Open Mail → Preferences → Signatures\n2. Create a new signature\n3. Paste the HTML content\n\n**Tips:**\n- Your profile link is included automatically — anyone who clicks it sees your live Profile Centre\n- If you update your profile, the link always points to the latest version\n- Use a template that matches your industry and brand style`,
      },
    ],
  },
  {
    id: 'support',
    icon: <HelpCircle className="w-5 h-5" />,
    title: 'Support Tickets',
    description: 'Raise and track support requests with the Profile Centre team',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    articles: [
      {
        id: 'st-1',
        title: 'Raising a support ticket',
        tags: ['support', 'ticket', 'help', 'contact', 'raise'],
        body: `If you need help with anything on Profile Centre, you can raise a support ticket directly from your dashboard.\n\n**To raise a ticket:**\n1. Go to Dashboard → Support Tickets\n2. Click "New Ticket"\n3. Select a category (Technical, Billing, Account, General, etc.)\n4. Enter a subject and describe your issue in detail\n5. Submit\n\n**Tips for a faster response:**\n- Be as specific as possible about the issue\n- Include any error messages you see\n- Mention which profile or feature is affected\n- Include screenshots if possible (describe what you see if you cannot attach images)\n\nThe Profile Centre team will respond to your ticket as soon as possible.`,
      },
      {
        id: 'st-2',
        title: 'Tracking and replying to tickets',
        tags: ['ticket', 'status', 'reply', 'track', 'update'],
        body: `You can track the status of your support tickets and reply to the team from your dashboard.\n\n**Ticket statuses:**\n- **Open** — Your ticket has been received and is awaiting a response\n- **In Progress** — The team is actively working on your issue\n- **Awaiting Your Reply** — The team has responded and is waiting for more information from you\n- **Resolved** — Your issue has been resolved\n- **Closed** — The ticket has been closed\n\n**To reply to a ticket:**\n1. Go to Dashboard → Support Tickets\n2. Open the ticket\n3. Type your reply in the message box\n4. Click Send\n\nYou will receive a notification when the team replies to your ticket.`,
      },
    ],
  },
  {
    id: 'security',
    icon: <Shield className="w-5 h-5" />,
    title: 'Security & Privacy',
    description: 'Keep your account secure and manage your data',
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    articles: [
      {
        id: 'sec-1',
        title: 'Auto-logout and session security',
        tags: ['logout', 'session', 'security', 'timeout', 'auto'],
        body: `For your security, your session automatically expires after a period of inactivity.\n\n**How it works:**\n- After 18 minutes of inactivity, you see a warning banner\n- After 20 minutes of inactivity, you are automatically logged out\n- Activity is tracked server-side — simply having the page open counts as activity\n\n**Session fingerprinting:**\nYour session is tied to your browser fingerprint (user agent and language settings). If these change mid-session (e.g. you switch browsers), you are automatically logged out for security.\n\n**To stay logged in:**\n- Keep the dashboard open and active\n- Click anywhere on the page to reset the inactivity timer\n- If you are logged out, simply sign in again`,
      },
      {
        id: 'sec-2',
        title: 'Telephone support PIN',
        tags: ['pin', 'support', 'telephone', 'verification', 'identity'],
        body: `When you contact our support team by phone, they will ask for your support PIN to verify your identity.\n\n**Your support PIN:**\n- Is a 6-digit code unique to your account\n- Rotates automatically every 30 minutes\n- Is visible in Dashboard → Security\n- Can be manually refreshed at any time\n\n**Never share your support PIN with anyone other than a Profile Centre support agent.** Our team will only ask for it during a support call — we will never ask for it via email or chat.`,
      },
      {
        id: 'sec-3',
        title: 'Your data rights (UK GDPR)',
        tags: ['gdpr', 'data', 'rights', 'privacy', 'sar', 'uk'],
        body: `As a UK GDPR data subject, you have the following rights regarding your personal data:\n\n**Right of access** — Request a copy of all data we hold about you (Subject Access Request)\n**Right to rectification** — Ask us to correct inaccurate data\n**Right to erasure** — Ask us to delete your data ("right to be forgotten")\n**Right to portability** — Receive your data in a machine-readable format\n**Right to object** — Object to certain types of processing\n\n**To exercise your rights:**\n1. Go to Dashboard → Data & Privacy\n2. Select the type of request\n3. Describe what you need\n4. Submit\n\nWe will respond within 30 days as required by UK GDPR. For urgent requests, contact support directly.\n\n**Self-service data export:**\nYou can also download a copy of your own data at any time from Dashboard → Data & Privacy → Export My Data. The export is a structured JSON file covering all data sections we hold about you.`,
      },
      {
        id: 'sec-4',
        title: 'Closing your account',
        tags: ['close', 'delete', 'account', 'cancel', 'closure'],
        body: `You can request to close your account at any time.\n\n**To close your account:**\n1. Go to Dashboard → Account\n2. Find the "Account Closure" section\n3. Read the information about what happens to your data\n4. Select a reason for closing\n5. Confirm your decision\n\n**What happens when you close your account:**\n- Your profiles are immediately unpublished\n- Your subscription is cancelled (no further charges)\n- Your data is scheduled for deletion within 30 days\n- You will receive a confirmation email\n\n**This action cannot be undone.** If you are unsure, consider pausing your account instead (contact support).`,
      },
    ],
  },
  {
    id: 'notifications',
    icon: <Bell className="w-5 h-5" />,
    title: 'Notifications',
    description: 'Manage how and when you receive notifications',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    articles: [
      {
        id: 'n-1',
        title: 'Types of notifications',
        tags: ['notifications', 'alerts', 'types', 'bell'],
        body: `Profile Centre sends you notifications for important platform events on your account.\n\n**Notification types:**\n- **New enquiry** — Someone submitted a contact enquiry on your profile\n- **Seat invite** — You have been invited to join an organisation profile\n- **Billing** — Subscription renewals, payment failures, plan changes\n- **Security** — Login alerts, session events, account security notices\n- **Support reply** — A reply to your support ticket\n- **Compliance** — Important compliance or policy notices\n- **System** — Platform announcements and important updates\n\n**Where to see notifications:**\nAll notifications appear in Dashboard → Notifications. A badge on the bell icon shows unread count.\n\n**Note:** Notifications are platform-to-you only. There is no visitor-to-user direct messaging on Profile Centre.`,
      },
      {
        id: 'n-2',
        title: 'Managing notification preferences',
        tags: ['notifications', 'settings', 'preferences', 'email', 'toggle'],
        body: `You can control which notifications you receive in your account settings.\n\n**To manage notifications:**\n1. Go to Dashboard → Notification Preferences\n2. Toggle individual notification types on or off\n3. Save your preferences\n\n**Email notifications** are sent for the most important events (billing, security). These cannot be fully disabled as they are required for account security.\n\n**In-app notifications** can be individually toggled. Dismissed notifications are permanently removed.\n\n**Service messages** — The "Service messages and notices" setting controls whether you receive platform service communications such as maintenance notices and policy updates.`,
      },
    ],
  },
  {
    id: 'data-requests',
    icon: <FileText className="w-5 h-5" />,
    title: 'Data Requests',
    description: 'Submit and track GDPR data requests',
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    articles: [
      {
        id: 'dr-1',
        title: 'Submitting a data request',
        tags: ['data', 'gdpr', 'request', 'sar', 'delete', 'portability'],
        body: `You can submit formal data requests directly from your dashboard.\n\n**Available request types:**\n- **Subject Access Request (SAR)** — Get a copy of all data we hold about you\n- **Data Deletion** — Request permanent deletion of your account and data\n- **Data Correction** — Ask us to correct inaccurate information\n- **Data Portability** — Receive your data in a portable format\n- **Withdraw Consent** — Withdraw previously given consent for data processing\n\n**To submit a request:**\n1. Go to Dashboard → Data & Privacy\n2. Click "New Request"\n3. Select the request type\n4. Describe your request in detail\n5. Submit\n\nWe will acknowledge your request within 72 hours and respond fully within 30 days.\n\n**Self-service data export:**\nYou can also download a copy of your own data at any time from Dashboard → Data & Privacy → Export My Data. The export is a structured JSON file covering all data sections we hold about you.`,
      },
      {
        id: 'dr-2',
        title: 'Tracking your request status',
        tags: ['status', 'tracking', 'request', 'progress', 'update'],
        body: `Once submitted, you can track the status of your data request in real time.\n\n**Status meanings:**\n- **Pending** — Your request has been received and is awaiting review\n- **In Progress** — We are actively working on your request\n- **Completed** — Your request has been fulfilled\n- **Rejected** — Your request could not be fulfilled (with reason provided)\n\nYou will receive a notification when the status of your request changes. For urgent requests, contact support directly and reference your request ID.`,
      },
    ],
  },
  {
    id: 'report-profile',
    icon: <Shield className="w-5 h-5" />,
    title: 'Reporting Profiles',
    description: 'Report profiles that violate our policies',
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    articles: [
      {
        id: 'rp-1',
        title: 'How to report a profile',
        tags: ['report', 'flag', 'abuse', 'profile', 'moderation'],
        body: `If you see a Profile Centre that violates our policies, you can report it directly from the profile page.\n\n**To report a profile:**\n1. Visit the public profile page\n2. Scroll to the bottom of the page — or use the "Report" button fixed to the bottom-right corner of the page\n3. Click "Report this profile" or "Report this business"\n4. Enter your name and email address\n5. Select a reason for your report\n6. Provide details about the issue\n7. Submit\n\n**Report reasons include:**\n- Spam or scam\n- Impersonation\n- Harassment or abuse\n- Illegal content\n- Adult or unsafe content\n- Misleading information\n- Privacy issue\n- Intellectual property issue\n- Other\n\nYour report is reviewed by the Profile Centre moderation team. We will take appropriate action in line with our Reporting and Moderation Policy.\n\n**UK GDPR notice:** Your name and email are used only to process the report and contact you if needed. We will not share your details with the profile owner.`,
      },
      {
        id: 'rp-2',
        title: 'What happens after you report a profile',
        tags: ['report', 'moderation', 'review', 'action', 'outcome'],
        body: `After you submit a report, the Profile Centre moderation team reviews it.\n\n**Possible outcomes:**\n- No action (if the report does not identify a policy violation)\n- Warning issued to the profile owner\n- Profile temporarily hidden pending investigation\n- Profile suspended (unpublished and locked)\n- Profile permanently removed\n- Account suspended or terminated\n- Report to authorities (for illegal content or threats)\n\n**False reports:** Submitting false or malicious reports may result in action against your own account.\n\nWe aim to review all reports within 5 working days. For urgent matters (threats, illegal content), contact support directly.\n\n**See also:** Our Reporting and Moderation Policy at japrofilestudio.jagroupservices.co.uk/legal/reporting-moderation`,
      },
    ],
  },

  {
    id: 'new-features',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'New Features (Starter+)',
    description: 'WhatsApp Button, Gallery, Menu/Price List, PDF Attachments, Social Links',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    articles: [
      {
        id: 'nf-1',
        title: 'WhatsApp Button',
        tags: ['whatsapp', 'button', 'chat', 'message', 'contact'],
        body: `Add a WhatsApp click-to-chat button to your public profile so visitors can message you instantly.\n\n**To set up your WhatsApp button:**\n1. Go to Dashboard → WhatsApp Button\n2. Toggle "Show WhatsApp button on profile" to On\n3. Enter your WhatsApp link in the format: https://wa.me/[country code][number]\n   - Example for a UK number: https://wa.me/447700123456\n   - Do not include the + sign — just the country code and number\n4. Optionally enter a custom button label (e.g. "Message us on WhatsApp")\n5. Click Save\n\n**Quick link builder:** Type your phone number (with country code, no +) into the quick builder field and the link will be auto-formatted for you.\n\n**Available on:** Starter, Professional, and Organisation plans.\n\n**Works on:** Personal Profile and Organisation Profile.`,
      },
      {
        id: 'nf-2',
        title: 'Gallery',
        tags: ['gallery', 'images', 'photos', 'portfolio', 'showcase'],
        body: `Showcase your work, products, or portfolio images on your public profile.\n\n**To add a gallery:**\n1. Go to Dashboard → Gallery\n2. Toggle "Show gallery on profile" to On\n3. Click "Add image"\n4. Enter an image URL or click "Upload" to upload an image from your device\n5. Add a caption and alt text (alt text helps screen readers and accessibility)\n6. Repeat for each image\n7. Click "Save gallery"\n\n**Image hosting:** You can use any publicly accessible image URL, or upload directly from your device (max 5MB per image).\n\n**Available on:** Starter, Professional, and Organisation plans.\n\n**Works on:** Personal Profile and Organisation Profile.`,
      },
      {
        id: 'nf-3',
        title: 'Menu / Price List',
        tags: ['menu', 'price list', 'services', 'catalogue', 'prices'],
        body: `Display a menu, price list, or service catalogue on your public profile.\n\n**To set up your menu:**\n1. Go to Dashboard → Menu / Price List\n2. Toggle "Show menu on profile" to On\n3. Set a section title (e.g. "Our Menu", "Price List", "Services")\n4. Click "Add item"\n5. For each item, enter:\n   - **Item name** (required)\n   - **Price** (optional — e.g. £25, From £50)\n   - **Category** (optional — groups items into sections)\n   - **Description** (optional)\n6. Click "Save menu"\n\n**Categories:** Items with the same category are grouped together under a section heading. Leave category blank for uncategorised items.\n\n**Preview:** A live preview of your menu is shown at the bottom of the page as you build it.\n\n**Available on:** Starter, Professional, and Organisation plans.\n\n**Works on:** Personal Profile and Organisation Profile.`,
      },
      {
        id: 'nf-4',
        title: 'PDF Attachments',
        tags: ['pdf', 'document', 'download', 'brochure', 'cv', 'attachment'],
        body: `Attach downloadable PDFs to your profile — brochures, CVs, menus, portfolios, or any document you want visitors to access.\n\n**To add PDF attachments:**\n1. Go to Dashboard → PDF Attachments\n2. Toggle "Show PDF attachments on profile" to On\n3. Click "Add PDF"\n4. For each document, enter:\n   - **Label** (required — e.g. "Company Brochure", "My CV")\n   - **PDF URL** (required — a direct link to your PDF file)\n   - **Description** (optional)\n5. Click "Save attachments"\n\n**Where to host your PDFs:**\n- **Google Drive** — Upload, right-click → Share → Anyone with the link → Copy link\n- **Dropbox** — Upload, click Share → Create link → Copy\n- **Your website** — Upload to your site and paste the direct URL\n\n**Important:** Make sure your PDF is set to public access before adding the link. Private or restricted files will not be accessible to visitors.\n\n**Available on:** Starter, Professional, and Organisation plans.\n\n**Works on:** Personal Profile and Organisation Profile.`,
      },
      {
        id: 'nf-5',
        title: 'Social Links Setup',
        tags: ['social', 'links', 'instagram', 'linkedin', 'twitter', 'icons'],
        body: `Add your social media profiles to your public card. These appear as branded icon links.\n\n**To set up social links:**\n1. Go to Dashboard → Social Links Setup\n2. Toggle "Show social links on profile" to On\n3. Click "Add social platform"\n4. For each platform:\n   - Select the platform from the dropdown (Instagram, LinkedIn, TikTok, GitHub, etc.)\n   - Enter your profile URL\n   - Optionally add a custom label\n5. Click "Save social links"\n\n**Supported platforms:** Instagram, Facebook, X / Twitter, LinkedIn, TikTok, YouTube, Pinterest, Snapchat, Threads, GitHub, Behance, Dribbble, and Other.\n\n**Note:** This is separate from the Links Manager. Social Links Setup creates branded icon-style links specifically for social media profiles. The Links Manager supports all link types including booking, contact, and custom URLs.\n\n**Available on:** Starter, Professional, and Organisation plans.\n\n**Works on:** Personal Profile.`,
      },
    ],
  },

  {
    id: 'install-app',
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Install as an App',
    description: 'Add Profile Centre to your home screen or desktop — no app store needed',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    articles: [
      {
        id: 'ia-1',
        title: 'What is a web app and why install it?',
        tags: ['install', 'pwa', 'web app', 'home screen', 'offline'],
        body: `Profile Centre is a Progressive Web App (PWA). This means you can install it directly from your browser — no App Store or Google Play required.\n\n**Benefits of installing:**\n- Appears on your home screen or desktop just like a native app\n- Opens in its own window (no browser address bar)\n- Loads faster after the first visit\n- Works offline for basic navigation\n- Receives updates automatically — always the latest version\n\n**No storage worries:** A PWA is much smaller than a native app. It uses your browser's cache, not your app storage.\n\n**Supported on:** iOS Safari, Android Chrome, Android Samsung Internet, desktop Chrome, desktop Edge, and desktop Safari (macOS Sonoma+).`,
      },
      {
        id: 'ia-2',
        title: 'Install on iPhone or iPad (iOS Safari)',
        tags: ['ios', 'iphone', 'ipad', 'safari', 'install', 'home screen', 'apple'],
        body: `iOS only supports PWA installation through Safari. Other browsers on iOS (Chrome, Firefox) do not support adding to home screen.\n\n**Steps:**\n1. Open Profile Centre in **Safari** on your iPhone or iPad\n2. Tap the **Share button** (the box with an arrow pointing up) at the bottom of the screen\n3. Scroll down in the share sheet and tap **"Add to Home Screen"**\n4. Edit the name if you like (we suggest "Profile Centre")\n5. Tap **"Add"** in the top-right corner\n\nThe app icon will appear on your home screen. Tap it to open Profile Centre in full-screen mode.\n\n**Tip:** If you don't see "Add to Home Screen", make sure you are using Safari and not Chrome or another browser. On iPad, the Share button may be in the top toolbar.\n\n**iOS 16.4+:** You can also receive push notifications once installed. You will be asked for permission the first time you open the installed app.`,
      },
      {
        id: 'ia-3',
        title: 'Install on Android (Chrome or Samsung Internet)',
        tags: ['android', 'chrome', 'samsung', 'install', 'home screen', 'google'],
        body: `Android supports automatic install prompts in Chrome and Samsung Internet.\n\n**Using Chrome (recommended):**\n1. Open Profile Centre in **Chrome** on your Android device\n2. A banner may appear at the bottom of the screen saying "Add Profile Centre to Home screen" — tap **"Add"**\n3. If the banner doesn't appear, tap the **three-dot menu** (⋮) in the top-right corner\n4. Tap **"Add to Home screen"** or **"Install app"**\n5. Tap **"Add"** or **"Install"** to confirm\n\n**Using Samsung Internet:**\n1. Open Profile Centre in **Samsung Internet**\n2. Tap the **menu icon** (three horizontal lines) at the bottom\n3. Tap **"Add page to"** → **"Home screen"**\n4. Tap **"Add"** to confirm\n\nThe app icon will appear on your home screen. It opens in full-screen mode without the browser address bar.\n\n**Note:** If you see a prompt at the bottom of the Profile Centre homepage, you can tap "Add to home screen" directly from there.`,
      },
      {
        id: 'ia-4',
        title: 'Install on desktop (Chrome or Edge)',
        tags: ['desktop', 'chrome', 'edge', 'windows', 'mac', 'install', 'pc'],
        body: `On desktop, Chrome and Microsoft Edge both support installing Profile Centre as a desktop app.\n\n**Using Chrome:**\n1. Open Profile Centre in **Google Chrome**\n2. Look for the **install icon** (a computer with a down arrow) in the address bar on the right side\n3. Click it and then click **"Install"**\n4. Alternatively, click the **three-dot menu** (⋮) → **"Cast, save, and share"** → **"Install page as app"**\n\n**Using Microsoft Edge:**\n1. Open Profile Centre in **Microsoft Edge**\n2. Click the **three-dot menu** (…) in the top-right corner\n3. Click **"Apps"** → **"Install this site as an app"**\n4. Click **"Install"** to confirm\n\nOnce installed, Profile Centre opens in its own window. You can find it in your Start Menu (Windows) or Applications folder (Mac) like any other app.\n\n**Note:** If you see a prompt at the bottom of the Profile Centre homepage, you can click "Install app" directly from there.`,
      },
      {
        id: 'ia-5',
        title: 'Install on Mac (Safari)',
        tags: ['mac', 'safari', 'macos', 'desktop', 'install', 'apple'],
        body: `Safari on macOS Sonoma (14) and later supports adding web apps to your Dock.\n\n**Steps:**\n1. Open Profile Centre in **Safari** on your Mac\n2. Click **"File"** in the menu bar\n3. Click **"Add to Dock…"**\n4. Edit the name if you like\n5. Click **"Add"**\n\nProfile Centre will appear in your Dock and can be launched like any other app.\n\n**Requires:** macOS Sonoma (14) or later. Earlier versions of macOS do not support this feature in Safari.\n\n**Alternative:** Use Chrome or Edge on Mac — both support PWA installation on all recent macOS versions (see the Chrome/Edge article above).`,
      },
      {
        id: 'ia-6',
        title: 'Uninstalling the app',
        tags: ['uninstall', 'remove', 'delete', 'home screen', 'app'],
        body: `You can remove Profile Centre from your home screen or desktop at any time. This does not affect your account or data.\n\n**iPhone / iPad:**\n1. Press and hold the Profile Centre icon on your home screen\n2. Tap **"Remove App"** or the **"–"** button\n3. Tap **"Delete from Home Screen"** (this only removes the shortcut — your account is unaffected)\n\n**Android:**\n1. Press and hold the Profile Centre icon\n2. Drag it to **"Remove"** or **"Uninstall"** at the top of the screen\n\n**Desktop Chrome:**\n1. Open the installed app\n2. Click the **three-dot menu** (⋮) in the top-right corner of the app window\n3. Click **"Uninstall Profile Centre"**\n\n**Desktop Edge:**\n1. Open the installed app\n2. Click the **three-dot menu** (…) → **"App settings"** → **"Uninstall"**\n\n**Mac (Dock):**\n1. Right-click the Profile Centre icon in the Dock\n2. Click **"Remove from Dock"**\n\nYou can always reinstall by visiting the site again and following the install steps.`,
      },
    ],
  },
];

// ─── Article component ────────────────────────────────────────────────────────

function ArticleItem({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);

  // Simple markdown-like renderer
  const renderBody = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{line.slice(2, -2)}</p>;
      }
      if (line.match(/^\d+\./)) {
        return <p key={i} className="text-sm text-muted-foreground ml-4 my-0.5">{line}</p>;
      }
      if (line.startsWith('- ')) {
        const parts = line.slice(2).split(/\*\*([^*]+)\*\*/g);
        return (
          <p key={i} className="text-sm text-muted-foreground ml-4 my-0.5">
            {'• '}
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part)}
          </p>
        );
      }
      if (line === '') return <div key={i} className="h-1" />;
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className="text-sm text-muted-foreground my-0.5">
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part)}
        </p>
      );
    });
  };

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 py-3 px-1 text-left hover:bg-muted/30 rounded-lg transition-colors group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{article.title}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="pb-4 px-1 space-y-0.5">
          {renderBody(article.body)}
        </div>
      )}
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategorySection({ cat, defaultOpen = false }: { cat: Category; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-border bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${cat.color}`}>
                {cat.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{cat.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                {cat.articles.length} article{cat.articles.length !== 1 ? 's' : ''}
              </Badge>
              {open
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
            </div>
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-border px-5 pb-2">
          {cat.articles.map(a => <ArticleItem key={a.id} article={a} />)}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HelpCentre() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [emailSigEnabled, setEmailSigEnabled] = useState(false);
  const [resettingSetup, setResettingSetup] = useState(false);
  const [setupReset, setSetupReset] = useState(false);

  // Personalisation flags derived from user
  const hasBusinessAccess    = !!(user?.hasBusinessAccess || user?.hasLifetimeAccess);
  const hasProfessionalAccess = !!(user?.hasProfessionalAccess || user?.hasBusinessAccess || user?.hasLifetimeAccess);
  const hasStarterAccess     = !!(user?.hasStarterAccess || hasProfessionalAccess || user?.trialActive);
  const hasPersonalAccess    = !!(hasStarterAccess || user?.plan_id); // any plan
  const firstName = user?.name?.split(' ')[0] ?? null;

  // Load feature flags to decide whether to show email signature help category
  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.json())
      .then(d => { if (d.success) setEmailSigEnabled(d.data?.feature_email_signature === '1'); })
      .catch(() => {});
  }, []);

  const handleRestartSetup = async () => {
    setResettingSetup(true);
    try {
      await fetch('/api/onboarding/reset', { method: 'POST', credentials: 'include' });
      setSetupReset(true);
      setTimeout(() => setSetupReset(false), 3000);
    } catch { /* non-fatal */ }
    setResettingSetup(false);
  };

  // Filter categories based on active features AND user's access tier
  const visibleCategories = useMemo(
    () => CATEGORIES.filter(cat => {
      if (cat.id === 'email-signature' && !emailSigEnabled) return false;
      // Organisation Profile — Professional, Business, Lifetime
      if (cat.id === 'organisation-profile' && !hasProfessionalAccess) return false;
      // Organisation Seats — Organisation plan and above
      if (cat.id === 'business-seats' && !hasBusinessAccess) return false;
      // Analytics — Professional plan and above
      if (cat.id === 'analytics' && !hasProfessionalAccess) return false;
      // Starter-gated categories
      if (['links', 'qr-codes', 'enquiries'].includes(cat.id) && !hasStarterAccess) return false;
      return true;
    }),
    [emailSigEnabled, hasBusinessAccess, hasProfessionalAccess, hasStarterAccess]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: { cat: Category; article: Article }[] = [];
    for (const cat of visibleCategories) {
      for (const article of cat.articles) {
        if (
          article.title.toLowerCase().includes(q) ||
          article.body.toLowerCase().includes(q) ||
          article.tags.some(t => t.includes(q))
        ) {
          results.push({ cat, article });
        }
      }
    }
    return results;
  }, [search, visibleCategories]);

  const quickLinks = [
    { icon: <Zap className="w-4 h-4" />, label: 'Getting started guide', href: '#getting-started' },
    ...(hasPersonalAccess ? [{ icon: <User className="w-4 h-4" />, label: 'Personal profile guide', href: '#profiles' }] : []),
    ...(hasProfessionalAccess ? [{ icon: <Building2 className="w-4 h-4" />, label: 'Organisation profile guide', href: '#organisation-profile' }] : []),
    { icon: <Link2 className="w-4 h-4" />, label: 'Adding links', href: '#links' },
    { icon: <QrCode className="w-4 h-4" />, label: 'QR codes', href: '#qr-codes' },
    { icon: <CreditCard className="w-4 h-4" />, label: 'Manage billing', href: '/dashboard/billing' },
    { icon: <FileText className="w-4 h-4" />, label: 'Submit a data request', href: '/dashboard/data-requests' },
    { icon: <AlertCircle className="w-4 h-4" />, label: 'Raise a support ticket', href: '/dashboard/support-tickets' },
    { icon: <Shield className="w-4 h-4" />, label: 'Your data rights', href: '#security' },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Help Centre — Profile Centre</title>
        <meta name="description" content="Find answers to your questions about Profile Centre." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/help-centre" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8 mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {firstName ? `Hi ${firstName} — how can we help?` : 'Help Centre'}
        </h1>
        <p className="text-muted-foreground mb-1 max-w-md mx-auto text-sm">
          {hasBusinessAccess && hasProfessionalAccess
            ? 'Guides for your personal profile, organisation profile, team seats, QR codes, email signature, and more.'
            : hasProfessionalAccess
              ? 'Guides for your organisation profile, personal profile, QR codes, and more.'
              : hasStarterAccess
                ? 'Guides for your personal profile, QR codes, links, analytics, and more.'
                : 'Guides for your personal profile, account settings, and more.'}
        </p>
        <div className="relative max-w-md mx-auto mt-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search help articles…"
            className="pl-10 bg-background border-border h-11 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchResults !== null && (
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-3">
            {searchResults.length === 0
              ? `No results for "${search}"`
              : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${search}"`
            }
          </p>
          {searchResults.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">No articles found</p>
                <p className="text-muted-foreground text-sm">Try different keywords, or browse the categories below.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {searchResults.map(({ cat, article }) => (
                <Card key={article.id} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${cat.color}`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">{cat.title}</p>
                        <ArticleItem article={article} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      {!search && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickLinks.map((ql, i) => (
              <a
                key={i}
                href={ql.href}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-colors group"
              >
                <span className="text-primary group-hover:scale-110 transition-transform">{ql.icon}</span>
                <span className="text-xs font-medium text-foreground leading-tight">{ql.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Status banner */}
      {!search && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">All systems operational</p>
            <p className="text-xs text-muted-foreground">Platform is running normally. No known issues.</p>
          </div>
        </div>
      )}

      {/* Categories */}
      {!search && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Browse by topic</h2>
          {visibleCategories.map((cat, i) => (
            <CategorySection key={cat.id} cat={cat} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {/* Restart setup guide */}
      {!search && (
        <Card className="border-border bg-card mt-6">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm mb-0.5">Assisted Setup Guide</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Step-by-step live guidance for setting up your{hasBusinessAccess ? ' organisation profile, organisation seats,' : hasProfessionalAccess ? ' organisation profile,' : ''} personal profile, QR code, and email signature. The guide appears automatically for new accounts and expires after 24 hours.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-2 h-8 text-xs"
                  onClick={handleRestartSetup}
                  disabled={resettingSetup}
                >
                  {resettingSetup
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  {setupReset ? 'Setup guide reopened!' : 'Reopen setup guide'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact support */}
      {!search && (
        <Card className="border-border bg-card mt-6">
          <CardContent className="p-6 text-center">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Still need help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <a
                href="/dashboard/data-requests"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <FileText className="w-4 h-4" /> Submit a request
              </a>
              <a
                href="/report-issue"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <AlertCircle className="w-4 h-4" /> Report an issue
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
