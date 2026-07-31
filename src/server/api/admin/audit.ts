import { type Request, type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { writeAudit, writeAuditLog } from '../../lib/audit.js';

export { writeAuditLog };

// Ensure legal_policies table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS legal_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    effective_date TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    is_published INTEGER NOT NULL DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed / backfill full policy content ──────────────────────────────────────
// Only writes if the row is missing OR still has the old placeholder content.
// Never overwrites content the admin has already edited.
const TODAY = new Date().toISOString().split('T')[0];
const EFFECTIVE = '14 July 2026';

// Force-refresh flag: bump this string to force all seeds to re-apply even if content exists.
// Change it only when you want to push a new policy version to all instances.
const SEED_VERSION = 'v1.0-2026-07-14';

const POLICY_SEEDS: Array<{ key: string; title: string; content: string; forceVersion?: string }> = [
  {
    key: 'terms',
    title: 'Terms of Service',
    forceVersion: SEED_VERSION,
    content: `# Terms of Service

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Acceptance of Terms

By accessing or using Profile Centre ("the Service"), operated by JA Group Services Ltd ("we", "us", "our"), you agree to be bound by these Terms of Service and all policies incorporated by reference. If you do not agree, please do not use the Service.

This Service is available to users aged **18 and over**. Public profiles may be viewed worldwide.

---

## 2. What Profile Centre Is

Profile Centre is a digital business card and professional profile platform operated by JA Group Services Ltd. It allows users to:

- Create and manage a personal or organisation digital profile
- Share their profile via a unique URL or QR code
- Add links, a WhatsApp button, gallery, menu/price list, PDF attachments, and social links to their profile (plan-dependent)
- Manage team member access to their organisation profile (Organisation plan and above)
- Receive professional enquiries via their profile (Starter plan and above)
- Order printed business cards linked to their digital profile (separate paid service)
- Build and share a branded email signature (Starter plan and above)
- Track profile analytics (Professional plan and above)

---

## 3. Your Account

3.1 You must be at least 18 years old to register.
3.2 You authenticate via **JA Group Services ID** — the identity and access management system operated by JA Group Services Ltd, powered by Microsoft Entra External ID. JA Group Services ID is governed by the JA Group Services website terms and privacy policy at jagroupservices.co.uk. We do not store passwords.
3.3 You are responsible for all activity under your account.
3.4 You must provide accurate information and keep it up to date.
3.5 Accounts are personal and non-transferable without our written consent.
3.6 You may only hold one active account unless we have given written permission for more.

---

## 4. Plans and Billing

4.1 We offer Free, Starter, Professional, Organisation, Ultimate Organisation, Ultimate Organisation+, and Lifetime plans. Features vary by plan — see our Plans & Billing page for current details.
4.2 The Free plan is always free with no expiry and no credit card required. Free plan users have access to the profile editor with limited features (1 profile, 1 link, basic themes).
4.3 Paid plans are billed monthly in advance via Stripe. The Lifetime plan is a one-time payment.
4.4 Prices are displayed inclusive of VAT where applicable.
4.5 You may cancel a subscription at any time. Cancellation takes effect at the end of the current billing period. The Lifetime plan is non-cancellable and non-refundable except as set out in our Refund Policy.
4.6 Refunds are governed by our Refund Policy.
4.7 We reserve the right to change pricing with 30 days' notice. Lifetime plan holders are not subject to price changes.

---

## 5. Acceptable Use

You agree not to use the Service for any unlawful purpose, to post defamatory or infringing content, to attempt unauthorised access, to use automated scraping tools, or to impersonate any person or entity. Full rules are set out in our Acceptable Use Policy, incorporated into these Terms.

---

## 6. Your Content

6.1 You retain ownership of all content you create and publish through the Service.
6.2 By publishing content, you grant us a limited, non-exclusive, royalty-free licence to display and transmit that content solely to provide the Service.
6.3 You are solely responsible for ensuring your content does not infringe third-party rights or violate applicable law.
6.4 We may remove content that violates our policies without notice.

---

## 7. Public Profiles

7.1 When you publish a profile, it is accessible to anyone with the URL.
7.2 You control what information appears on your public profile.
7.3 We are not responsible for how third parties use information you choose to make public.
7.4 You may unpublish your profile at any time from your dashboard.

---

## 8. Business Cards (Printed)

8.1 Printed business card orders are a separate paid service and are not included in any subscription plan.
8.2 Orders are fulfilled by our print partner. Pricing, turnaround times, and specifications are confirmed by admin before payment is taken.
8.3 Payment for business card orders is collected via a Stripe payment link or invoice issued by Profile Centre admin. Do not pay via any link that has not been issued through this official process.
8.4 Once a design proof has been approved and sent to print, the order cannot be cancelled or refunded.
8.5 Delivery timescales are estimates and not guaranteed.
8.6 See our Refund Policy for full details on business card orders.

---

## 9. Intellectual Property

9.1 The Service, its design, code, and original content are owned by JA Group Services Ltd and protected by UK intellectual property law.
9.2 "Profile Centre" and "JA Group Services" are trading names of JA Group Services Ltd. You may not use them without our written consent.
9.3 You may not copy, reverse-engineer, or create derivative works from the Service.

---

## 10. Privacy and Data

Your use of the Service is governed by our Privacy Policy, which explains how we collect, use, and protect your personal data in accordance with UK GDPR.

Your use of JA Group Services ID for authentication is additionally governed by the JA Group Services privacy policy at jagroupservices.co.uk.

---

## 11. Service Availability

11.1 We aim to maintain high availability but do not guarantee uninterrupted access.
11.2 We may carry out scheduled maintenance, which we will communicate in advance where possible.
11.3 We are not liable for losses arising from service unavailability.

---

## 12. Limitation of Liability

To the maximum extent permitted by law, JA Group Services Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.

Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.

---

## 13. Termination

13.1 You may close your account at any time via Dashboard → Account → Close Account.
13.2 We may suspend or terminate your account for breach of these Terms, non-payment, or at our discretion with reasonable notice.
13.3 On termination, your profile is immediately unpublished. Your data is retained for 30 days then permanently deleted, subject to legal retention obligations.

---

## 14. Changes to These Terms

We may update these Terms from time to time. We will notify you of material changes by email and by updating the version number and effective date. Continued use of the Service after the effective date constitutes acceptance of the revised Terms.

---

## 15. Governing Law

These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 16. Contact

**JA Group Services Ltd**
Email: legal@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'privacy',
    title: 'Privacy Policy',
    forceVersion: SEED_VERSION,
    content: `# Privacy Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Data Controller:** JA Group Services Ltd

---

## 1. Introduction

JA Group Services Ltd ("we", "us", "our") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use Profile Centre ("the Service"). It also sets out your rights under UK GDPR and how to exercise them.

This policy complies with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.

**Note on JA Group Services ID:** Authentication for Profile Centre is handled by JA Group Services ID, the identity and access management system operated by JA Group Services Ltd. Your use of JA Group Services ID is additionally governed by the JA Group Services website privacy policy and terms at jagroupservices.co.uk. This policy covers data processed by Profile Centre specifically.

---

## 2. Data Controller

**JA Group Services Ltd**
Email: privacy@jagroupservices.co.uk
Website: jagroupservices.co.uk

---

## 3. Data We Collect

### 3.1 Account Data
- Name and email address (provided via JA Group Services ID)
- Account creation date and last login timestamp
- Plan and subscription status

### 3.2 Profile Data
- Professional information you choose to add: job title, company, bio, phone number, website URL, business address
- Profile photo and cover image (if uploaded)
- Links and social media handles you add to your profile
- WhatsApp button link (if added — Starter plan and above)
- Gallery images (if added — Starter plan and above)
- Menu / price list items (if added — Starter plan and above)
- PDF attachment links (if added — Starter plan and above)
- Organisation profile information (for Professional plan and above: organisation name, logo, services, team, opening hours, etc.)

### 3.3 Usage Data
- Page views and link clicks on your public profile (used for your analytics dashboard — Professional plan and above)
- IP addresses (anonymised after 30 days; never shared with third parties)
- Browser type and device information (aggregated, not linked to your identity)
- Session activity logs (for security purposes only)

### 3.4 Communications
- Messages submitted via your profile's contact form (Starter plan and above)
- Support requests and enquiries submitted to us
- Email communication history

### 3.5 Billing Data
- Subscription plan and billing history (payment card details are held by Stripe, not by us)
- VAT number (if provided for business billing)

### 3.6 Technical Data
- Audit logs of administrative actions (admin accounts only)
- Security event logs (login attempts, PIN verifications)

---

## 4. How We Use Your Data

| Purpose | Legal Basis |
|---|---|
| Providing and maintaining the Service | Contract (Art. 6(1)(b) UK GDPR) |
| Displaying your public profile to visitors | Contract (Art. 6(1)(b) UK GDPR) |
| Sending service-related notifications | Contract (Art. 6(1)(b) UK GDPR) |
| Processing payments and managing subscriptions | Contract (Art. 6(1)(b) UK GDPR) |
| Analysing platform usage and improving the Service | Legitimate interests (Art. 6(1)(f) UK GDPR) |
| Maintaining security and preventing fraud | Legitimate interests (Art. 6(1)(f) UK GDPR) |
| Complying with legal obligations | Legal obligation (Art. 6(1)(c) UK GDPR) |
| Sending marketing communications (if opted in) | Consent (Art. 6(1)(a) UK GDPR) |

---

## 5. Analytics and Tracking

We use Google Analytics 4 to understand how visitors use the Service. **Google Analytics is only loaded after you have given explicit consent via our cookie banner.** If you decline, no analytics cookies are set and no data is sent to Google.

When analytics is active, we apply the following privacy protections:
- IP anonymisation is enabled — your full IP address is never sent to Google
- Google Signals is disabled — no cross-site tracking or remarketing
- Ad personalisation signals are disabled
- Restricted data processing is enabled — Google cannot use your data for its own purposes

You can withdraw consent at any time via the cookie banner or your browser settings.

---

## 6. Data Sharing

We do not sell your personal data. We share data only as follows:

- **JA Group Services ID** — Authentication and identity management (governed by JA Group Services website terms at jagroupservices.co.uk)
- **Stripe** — Payment processing (Stripe's privacy policy applies to payment data)
- **Google Analytics** — Anonymised, aggregated usage data (only with your consent; see Section 5)
- **Hosting infrastructure** — Our servers are operated in compliance with applicable security standards
- **Law enforcement** — Where required by law or court order
- **Professional advisers** — Lawyers, accountants, auditors, under confidentiality obligations

We do not transfer your data outside the UK/EEA without appropriate safeguards.

---

## 7. Data Retention

We retain your data for the following periods:

| Data Type | Retention Period |
|---|---|
| Account data (name, email, preferences) | Duration of account + 30 days after deletion |
| Profile data (bio, links, photos) | Duration of account + 30 days after deletion |
| Profile analytics (views, clicks) | 24 months rolling |
| Enquiry and message history | 36 months |
| Support request history | 36 months |
| Security and audit logs | 12 months |
| Billing records | 7 years (UK tax law requirement) |
| IP addresses (raw) | 30 days, then anonymised |

When you close your account, your profile is immediately unpublished. After 30 days, all personal data is permanently and irreversibly deleted, except billing records which are retained for 7 years as required by law.

Accounts inactive for 24 consecutive months may be reviewed. We will contact you before taking any action.

---

## 8. Your Rights Under UK GDPR

You have the following rights in relation to your personal data:

### 8.1 Right of Access
You may request a copy of all personal data we hold about you. Submit a Subject Access Request (SAR) via Dashboard → Data & Privacy → Subject Access Request. We will respond within **30 days**.

### 8.2 Right to Rectification
You may request correction of inaccurate or incomplete data. Most data can be updated directly in your dashboard. For data you cannot update yourself, contact privacy@jagroupservices.co.uk.

### 8.3 Right to Erasure ("Right to be Forgotten")
You may request deletion of your personal data where it is no longer necessary, you withdraw consent, or it has been unlawfully processed. Some data may be retained where we have a legal obligation (e.g. billing records).

### 8.4 Right to Restriction of Processing
You may request that we restrict processing of your data in certain circumstances, such as while a dispute about accuracy is resolved.

### 8.5 Right to Data Portability
You may receive your personal data in a structured, machine-readable format (JSON). Export your data via Dashboard → Data & Privacy → Export My Data.

### 8.6 Right to Object
You may object to processing for direct marketing at any time. Manage preferences via Dashboard → Notification Preferences.

### 8.7 Rights Related to Automated Decision-Making
We do not make solely automated decisions that produce legal or similarly significant effects on you.

To exercise any of these rights, use the self-service tools in your dashboard or email privacy@jagroupservices.co.uk. We will respond within **30 days**. In complex cases we may extend this by a further 2 months and will notify you.

---

## 9. Cookies

We use essential cookies for session management and optional analytics cookies (only with your consent). See our Cookie Policy for full details.

---

## 10. Security

We implement appropriate technical and organisational measures to protect your data, including:
- Encryption in transit (TLS 1.2+) on all connections
- Encrypted storage of sensitive credentials
- Role-based access controls and multi-factor authentication for staff
- Regular security reviews
- Audit logging of all administrative actions

See our Security Policy for full details.

---

## 11. Children

This Service is not directed at children under 18. We do not knowingly collect data from anyone under 18. If we become aware of such data, we will delete it promptly.

---

## 12. Changes to This Policy

We will notify you of material changes by email and by updating the version number and effective date. Continued use of the Service after the effective date constitutes acceptance.

---

## 13. Complaints

If you are not satisfied with how we handle your data, you have the right to lodge a complaint with the **Information Commissioner's Office (ICO)**:
- Website: ico.org.uk
- Phone: 0303 123 1113

---

## 14. Contact

**JA Group Services Ltd — Data Protection**
Email: privacy@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'cookies',
    title: 'Cookie Policy',
    forceVersion: SEED_VERSION,
    content: `# Cookie Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. What Are Cookies?

Cookies are small text files placed on your device when you visit a website. They help websites function correctly, remember your preferences, and provide information to website owners about how their site is used.

---

## 2. Cookies We Use

### 2.1 Essential Cookies (Always Active)

These cookies are strictly necessary for the Service to function. They cannot be switched off in our systems. You can set your browser to block them, but this will prevent you from signing in.

| Cookie Name | Purpose | Duration |
|---|---|---|
| connect.sid | Session management — keeps you signed in | Session |
| c2_analytics_consent | Stores your cookie consent preference | 12 months |
| csrf_token | Cross-site request forgery protection | Session |

### 2.2 Analytics Cookies (Optional — requires your consent)

These cookies allow us to count visits and understand how visitors interact with the Service, so we can measure and improve performance. **These cookies are only set after you have given explicit consent via our cookie banner.**

| Cookie Name | Purpose | Duration |
|---|---|---|
| _ga | Google Analytics — distinguishes users | 2 years |
| _ga_* | Google Analytics — session state | 2 years |

When analytics is active, IP anonymisation is enabled and ad personalisation is disabled. See our Privacy Policy for full details.

---

## 3. Third-Party Cookies

### 3.1 JA Group Services ID
Our authentication system (JA Group Services ID, powered by Microsoft Entra External ID) may set its own session cookies during the sign-in process. These are essential for authentication and are governed by the JA Group Services website privacy policy at jagroupservices.co.uk.

### 3.2 Stripe
If you access billing or payment pages, Stripe may set cookies for fraud prevention and payment processing. These are governed by Stripe's privacy policy.

---

## 4. Managing Your Cookie Preferences

You can manage cookies in the following ways:

- **Cookie banner** — Shown on your first visit. You can accept or decline optional analytics cookies.
- **Browser settings** — Most browsers allow you to block or delete cookies. See your browser's help documentation.
- **Google Analytics opt-out** — Install the Google Analytics Opt-out Browser Add-on at tools.google.com/dlpage/gaoptout.

Note: Blocking essential cookies will prevent you from signing in to the Service.

---

## 5. Changes to This Policy

We will update this policy when we add or change cookies. The effective date at the top of this page will be updated accordingly.

---

## 6. Contact

For questions about our use of cookies:
**JA Group Services Ltd**
Email: privacy@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'acceptable_use',
    title: 'Acceptable Use Policy',
    forceVersion: SEED_VERSION,
    content: `# Acceptable Use Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Introduction

This Acceptable Use Policy ("AUP") sets out the rules governing the use of Profile Centre ("the Service"), operated by JA Group Services Ltd. By using the Service, you agree to comply with this policy. This AUP is incorporated into our Terms of Service.

This Service is available to users aged **18 and over**.

---

## 2. Permitted Use

You may use the Service to:
- Create and manage your professional digital profile (all plans, including Free)
- Share your profile link or QR code
- Add links, a WhatsApp button, gallery, menu/price list, PDF attachments, and social links to your profile (plan-dependent)
- Manage organisation team profiles (Organisation plan and above)
- Receive and respond to professional enquiries (Starter plan and above)
- Order printed business cards linked to your profile (separate paid service)
- Build and share a branded email signature (Starter plan and above)

---

## 3. Prohibited Content

You must not use the Service to create, upload, or share content that:
- Is unlawful, harmful, threatening, abusive, harassing, defamatory, or obscene
- Infringes any third-party intellectual property rights (copyright, trademark, etc.)
- Contains personal data of others without their explicit consent
- Promotes discrimination based on race, gender, religion, nationality, disability, sexual orientation, or age
- Constitutes spam or unsolicited commercial communications
- Contains malware, viruses, or any other harmful software or code
- Is false, misleading, or deceptive
- Impersonates any person, company, or organisation

---

## 4. Prohibited Activities

You must not:
- Attempt to gain unauthorised access to the Service, its servers, or any connected systems
- Use automated tools (bots, scrapers, crawlers) to access, extract, or index data from the Service without our written consent
- Circumvent any security measures, rate limits, or access controls
- Use the Service to conduct phishing, fraud, or any deceptive activity
- Resell, sublicence, or commercially exploit access to the Service without our written consent
- Use the Service in a way that could damage, disable, overload, or impair its performance
- Attempt to reverse-engineer, decompile, or extract source code from the Service
- Create multiple accounts to circumvent restrictions or bans

---

## 5. Organisation Accounts and Team Seats

5.1 Organisation plan accounts must be registered by an authorised representative of the organisation.
5.2 Team seat invitations may only be sent to individuals who have consented to join.
5.3 You are responsible for ensuring all team members comply with this AUP.
5.4 Misuse by a team member may result in action against the account holder.

---

## 6. Public Profiles

6.1 You are solely responsible for the content of your public profile, including any gallery images, menu items, PDF attachments, and social links you add.
6.2 Do not include sensitive personal data (e.g. National Insurance numbers, passport numbers, bank details) on your public profile.
6.3 Do not include personal data of third parties without their consent.
6.4 Profiles must accurately represent you or your organisation. Impersonation is strictly prohibited.
6.5 PDF attachments and gallery images must not contain illegal, harmful, or infringing content.

---

## 7. Enforcement

7.1 We may investigate suspected violations of this AUP at any time.
7.2 Violations may result in content removal, account suspension, or permanent termination.
7.3 We may refer serious violations (e.g. illegal content) to law enforcement.
7.4 We will not be liable for any losses arising from enforcement action taken in good faith.

---

## 8. Reporting Violations

If you believe someone is violating this AUP, please report it via the "Report this profile" button on any public profile, or email: abuse@jagroupservices.co.uk

---

## 9. Contact

**JA Group Services Ltd**
Email: legal@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'refunds',
    title: 'Refund Policy',
    forceVersion: SEED_VERSION,
    content: `# Refund Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Overview

This Refund Policy applies to all paid subscriptions and services offered by JA Group Services Ltd through Profile Centre. By purchasing a subscription or service, you agree to the terms of this policy.

---

## 2. Subscription Plans

### 2.1 Monthly Subscriptions
Monthly subscription fees are charged in advance. If you cancel your subscription, you will retain access until the end of the current billing period. **No refunds are issued for unused portions of a monthly billing period.**

### 2.2 Lifetime Plan
The Lifetime plan is a one-time payment that grants permanent access to the Service. **The Lifetime plan is non-refundable** except within **14 days of the initial purchase**, provided:
- The account has not been used to generate significant platform activity (more than 5 profile views, business card orders, or active seat invitations)
- The request is submitted to billing@jagroupservices.co.uk within the 14-day window

After 14 days, **no refunds are issued** for Lifetime plan purchases.

### 2.3 Free Plan
The Free plan has no charge and is not subject to this policy.

---

## 3. Printed Business Card Orders

3.1 Business card orders are a separate paid service and are not included in any subscription plan.
3.2 Payment is collected via a Stripe payment link or invoice issued by Profile Centre admin after your order details have been confirmed. Do not pay via any link that has not been issued through this official process.
3.3 Once a design proof has been **approved by you and sent to print**, no refund is available.
3.4 If a proof has not yet been approved, a partial refund may be available at our discretion, less any design work already completed.
3.5 We are not responsible for errors in content you approved on the proof.
3.6 If cards arrive damaged or with a print error caused by us, we will reprint or refund at our discretion.

---

## 4. Exceptional Circumstances

We may issue refunds at our discretion in exceptional circumstances, including:
- Duplicate charges caused by a billing error on our part
- Service unavailability exceeding **72 consecutive hours** during a paid billing period
- Charges made after a confirmed cancellation

---

## 5. How to Request a Refund

To request a refund, contact us at:
**Email:** billing@jagroupservices.co.uk

Please include:
- Your account email address
- The charge date and amount
- The reason for your request

We aim to respond within **5 business days**.

---

## 6. Chargebacks

If you initiate a chargeback with your bank or card provider without first contacting us, we reserve the right to suspend your account pending resolution. We encourage you to contact us first — we are committed to resolving billing issues fairly.

---

## 7. Contact

**JA Group Services Ltd**
Email: billing@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'complaints',
    title: 'Complaints Policy',
    forceVersion: SEED_VERSION,
    content: `# Complaints Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Our Commitment

JA Group Services Ltd is committed to providing a high-quality service. If something goes wrong or you are dissatisfied with any aspect of Profile Centre, we want to hear from you so we can put it right.

---

## 2. What You Can Complain About

You can raise a complaint about:
- The quality or availability of the Service
- How we have handled your personal data
- A billing or payment dispute
- The conduct of our staff
- A decision we have made about your account
- Content moderation decisions
- Any other aspect of our service

---

## 3. How to Make a Complaint

**Option 1 — In-app:** Dashboard → Support → Submit a complaint

**Option 2 — Email:** complaints@jagroupservices.co.uk

**Option 3 — Post:** JA Group Services Ltd, England

Please include:
- Your full name and account email address
- A clear description of the issue
- Relevant dates, reference numbers, or screenshots
- What outcome you are seeking

---

## 4. Our Response Timescales

| Stage | Timescale |
|---|---|
| Acknowledgement | Within 2 business days |
| Initial response | Within 5 business days |
| Full investigation and resolution | Within 20 business days |

If your complaint is complex and requires more time, we will keep you informed of progress and provide an updated timescale.

---

## 5. Escalation

If you are not satisfied with our initial response, you may escalate by replying to our response and requesting escalation to a senior member of our team. We will review escalated complaints within a further 10 business days.

---

## 6. External Resolution

### Data Protection Complaints
If your complaint relates to how we handle your personal data, you have the right to lodge a complaint with the **Information Commissioner's Office (ICO)**:
- Website: ico.org.uk
- Phone: 0303 123 1113

### Financial Disputes
If your complaint relates to a billing or payment dispute that we have not resolved to your satisfaction, you may be able to raise a dispute with your card provider or bank.

---

## 7. Contact

**JA Group Services Ltd**
Email: complaints@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'accessibility',
    title: 'Accessibility Statement',
    forceVersion: SEED_VERSION,
    content: `# Accessibility Statement

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Our Commitment

JA Group Services Ltd is committed to making Profile Centre accessible to as many people as possible. We aim to meet the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standard across all pages of the Service.

---

## 2. What We Do

We work to ensure that:
- All pages have meaningful, unique page titles and a logical heading structure
- Images have descriptive alternative text (or empty alt for decorative images)
- Colour contrast meets WCAG AA requirements (4.5:1 for normal text, 3:1 for large text)
- The platform is fully navigable by keyboard alone
- All form fields have clearly associated labels
- Error messages are descriptive and guide users to correct input
- Focus indicators are visible on all interactive elements
- ARIA labels are used for complex interactive components
- The Service works with common screen readers

---

## 3. Known Limitations

We are aware of the following areas where accessibility may be limited:

- Some generated PDF documents (e.g. business card PDFs) may not be fully accessible to screen readers. We are working to improve this.
- Some third-party embedded content (e.g. Stripe payment widgets) may have accessibility limitations outside our direct control.
- Some complex data tables in the admin dashboard may not be fully optimised for screen reader navigation.

We are actively working to address these issues.

---

## 4. Technical Information

Profile Centre is built using React, TypeScript, and standard HTML5 with semantic markup. We test accessibility using:
- NVDA screen reader on Windows
- VoiceOver on macOS and iOS
- Keyboard-only navigation testing
- Automated accessibility scanning tools

---

## 5. Feedback and Contact

If you experience any accessibility barriers when using Profile Centre, please contact us:

**Email:** accessibility@jagroupservices.co.uk

We aim to respond within **5 business days** and will work with you to provide the information or functionality you need in an accessible format.

---

## 6. Enforcement

If you are not satisfied with our response to an accessibility complaint, you can contact the **Equality Advisory and Support Service (EASS)**:
- Website: equalityadvisoryservice.com
- Phone: 0808 800 0082

---

## 7. Contact

**JA Group Services Ltd**
Email: accessibility@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'eligibility',
    title: 'Eligibility Policy',
    forceVersion: SEED_VERSION,
    content: `# Eligibility Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Age Requirement

Profile Centre is available to users aged **18 and over only**. By registering for an account, you confirm that you are at least 18 years of age.

We do not knowingly collect personal data from individuals under 18. If we become aware that an account has been created by someone under 18, we will close the account and delete the associated data promptly.

---

## 2. Geographic Availability

Profile Centre is operated by JA Group Services Ltd, a company registered in England and Wales. The Service is primarily intended for **UK-based users**.

- **Account registration** is open to users aged 18 and over.
- **Public profiles** may be viewed worldwide by anyone with the profile URL.
- Users outside the UK are welcome to register, but the Service is governed by UK law and UK GDPR.

---

## 3. Account Registration Requirements

To register, you must:
- Be aged 18 or over
- Provide accurate and truthful information during registration
- Agree to our Terms of Service and Privacy Policy
- Not have previously had an account terminated for a breach of our policies
- Authenticate via **JA Group Services ID** — the identity and access management system operated by JA Group Services Ltd (see jagroupservices.co.uk for JA Group Services ID terms and privacy policy)

---

## 4. Organisation Accounts

Organisation plan accounts must be registered by an **authorised representative** of the organisation. By registering an organisation account, you confirm that you have authority to bind the organisation to our Terms of Service.

Organisation accounts may add team members (seats) who must also meet the eligibility requirements above.

---

## 5. Identity Verification

We reserve the right to request verification of your identity or organisation at any time. This may include:
- Proof of identity (e.g. passport or driving licence)
- Proof of organisation registration (e.g. Companies House number)

Failure to provide satisfactory verification within a reasonable timeframe may result in account suspension.

---

## 6. Prohibited Registrations

The following are not eligible to register:
- Individuals under 18 years of age
- Individuals previously banned from the Service
- Entities or individuals subject to applicable sanctions

---

## 7. Contact

**JA Group Services Ltd**
Email: legal@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'reporting',
    title: 'Reporting & Moderation Policy',
    forceVersion: SEED_VERSION,
    content: `# Reporting & Moderation Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Introduction

JA Group Services Ltd operates Profile Centre ("the Service"). This policy explains how we handle reports of harmful, illegal, or policy-violating content on public profiles, and how we moderate the platform.

---

## 2. What You Can Report

You may report a public profile or content if you believe it:
- Violates our Acceptable Use Policy
- Contains illegal content (e.g. fraud, impersonation, child exploitation material)
- Is defamatory, harassing, or threatening
- Infringes intellectual property rights
- Contains personal data shared without consent
- Is spam or deceptive commercial content
- Poses a risk to public safety

---

## 3. How to Submit a Report

**Option 1 — In-app:** Use the "Report this profile" button on any public profile page.

**Option 2 — Email:** abuse@jagroupservices.co.uk

When submitting a report, please include:
- The URL of the profile or content you are reporting
- The reason for your report (select from the categories above)
- Any supporting evidence or context

Reports are treated as confidential. We will not share your identity with the profile owner.

---

## 4. Our Review Process

| Stage | Timescale |
|---|---|
| Acknowledgement | Within 2 business days |
| Initial review | Within 5 business days |
| Full investigation and decision | Within 20 business days |

### 4.1 Automated Risk Scanning
All submitted reports trigger an automated risk scan of the reported profile. Profiles assessed as critical risk may be automatically hidden pending manual review.

### 4.2 Actions We May Take
Following investigation, we may:
- Remove or hide the reported content
- Issue a warning to the account holder
- Suspend or terminate the account
- Refer the matter to law enforcement
- Take no action if the report is not upheld

### 4.3 Notification
We will notify you of the outcome of your report where possible, subject to confidentiality obligations.

---

## 5. Appeals

If you are a profile owner and believe your content was removed in error, you may appeal by emailing:
**appeals@jagroupservices.co.uk**

Please include your account details and the reason for your appeal. We will review appeals within **10 business days**.

---

## 6. Misuse of the Reporting System

Submitting false or malicious reports is a violation of our Acceptable Use Policy and may result in action being taken against your account.

---

## 7. Contact

**JA Group Services Ltd**
Email: abuse@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'security',
    title: 'Security Policy',
    forceVersion: SEED_VERSION,
    content: `# Security Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Introduction

JA Group Services Ltd takes the security of Profile Centre and your personal data seriously. This Security Policy describes our approach to protecting the Service and its users. It is written for public transparency — it does not disclose implementation details that could create security risks.

---

## 2. Infrastructure Security

- **Encryption in Transit** — All data between your browser and our servers is encrypted using TLS 1.2 or higher (HTTPS). We enforce HTTPS on all endpoints and redirect HTTP to HTTPS.
- **Encryption at Rest** — Sensitive data, including session tokens and credentials, is stored using industry-standard hashing and encryption.
- **Access Controls** — Access to production systems is restricted to authorised personnel only, using multi-factor authentication and role-based access controls.
- **Security Headers** — We implement HTTP security headers including HSTS, Content Security Policy (CSP), X-Frame-Options, Referrer-Policy, and Permissions-Policy.

---

## 3. Authentication Security

- We do not store passwords. All authentication is handled by **JA Group Services ID** (powered by Microsoft Entra External ID), which provides enterprise-grade identity management. JA Group Services ID is operated by JA Group Services Ltd and governed by the JA Group Services website terms at jagroupservices.co.uk.
- Session tokens are cryptographically signed and expire after a period of inactivity.
- Rate limiting is applied to all authentication endpoints to prevent brute-force attacks.
- Admin access requires a secondary PIN verification in addition to identity authentication.

---

## 4. Application Security

- **Rate Limiting** — All API endpoints are rate-limited to prevent abuse.
- **Input Validation** — All user inputs are validated and sanitised server-side.
- **CSRF Protection** — Cross-Site Request Forgery protection is applied to all state-changing operations.
- **Content Security Policy** — A strict CSP is enforced to mitigate cross-site scripting (XSS) attacks.
- **Dependency Management** — We regularly review and update third-party dependencies.

---

## 5. Data Security

- Personal data is processed in accordance with our Privacy Policy and UK GDPR.
- We implement the principle of least privilege — staff and systems only access data necessary for their function.
- Audit logs are maintained for all administrative actions and sensitive data access.
- IP addresses are anonymised after 30 days.
- Analytics tracking (Google Analytics) is only activated after explicit user consent. No personal data is sent to Google Analytics without consent.

---

## 6. Incident Response

- We maintain an incident response plan to address security breaches promptly.
- In the event of a personal data breach, we will notify affected users and the Information Commissioner's Office (ICO) in accordance with UK GDPR requirements (within 72 hours where required).
- We will communicate clearly with affected users about any breach that poses a risk to their rights and freedoms.

---

## 7. Vulnerability Disclosure

If you discover a security vulnerability in our Service, please report it responsibly to:
**security@jagroupservices.co.uk**

Please do not publicly disclose the vulnerability until we have had a reasonable opportunity to investigate and address it. We will acknowledge receipt within **2 business days** and aim to resolve critical issues within **30 days**.

---

## 8. Security Reviews

We conduct regular security reviews of our platform. Findings are prioritised and addressed according to severity.

---

## 9. Contact

**JA Group Services Ltd**
Email: security@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'data_retention',
    title: 'Data Retention Policy',
    forceVersion: SEED_VERSION,
    content: `# Data Retention Policy

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Overview

This policy explains how long JA Group Services Ltd retains personal data collected through Profile Centre, and when that data is deleted. It should be read alongside our Privacy Policy.

---

## 2. Retention Periods

| Data Type | Retention Period | Reason |
|---|---|---|
| Account data (name, email, preferences) | Duration of account + 30 days | Service provision; recovery window |
| Profile data (bio, links, photos) | Duration of account + 30 days | Service provision; recovery window |
| Profile analytics (views, clicks) | 24 months rolling | Platform improvement |
| Enquiry and message history | 36 months | Service provision; dispute resolution |
| Support request history | 36 months | Service provision; dispute resolution |
| Security and audit logs | 12 months | Security monitoring; compliance |
| Billing records | 7 years | UK tax law (HMRC requirement) |
| IP addresses (raw) | 30 days, then anonymised | Security; fraud prevention |
| Consent records | 7 years | Legal compliance |

---

## 3. Account Closure

When you close your account:

1. Your profile is **immediately unpublished** and removed from public access.
2. Your personal data is retained for **30 days** to allow recovery if the closure was accidental.
3. After 30 days, your account data is **permanently and irreversibly deleted**.
4. Billing records are retained for **7 years** as required by UK tax law.
5. Anonymised, aggregated analytics data may be retained indefinitely as it cannot identify you.

---

## 4. Inactive Accounts

Accounts that have been inactive for **24 consecutive months** may be flagged for review. We will contact you at your registered email address before taking any action on an inactive account.

---

## 5. Requesting Deletion

You may request deletion of your data at any time:
- **Self-service:** Dashboard → Account → Close Account
- **Email request:** privacy@jagroupservices.co.uk

We will process deletion requests within **30 days**, subject to any legal retention obligations (e.g. billing records).

---

## 6. Requesting Your Data

You may request a copy of all data we hold about you:
- **Self-service:** Dashboard → Data & Privacy → Subject Access Request
- **Email request:** privacy@jagroupservices.co.uk

We will respond within **30 days**.

---

## 7. Contact

**JA Group Services Ltd**
Email: privacy@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
  {
    key: 'data_rights',
    title: 'Data Subject Rights',
    forceVersion: SEED_VERSION,
    content: `# Data Subject Rights

**Effective Date:** ${EFFECTIVE}
**Version:** 1.0
**Operated by:** JA Group Services Ltd

---

## 1. Your Rights Under UK GDPR

As a data subject under UK GDPR, you have the following rights in relation to the personal data we hold about you. Full details of how we use your data are in our Privacy Policy.

---

## 2. Right of Access (Article 15)

You have the right to request a copy of the personal data we hold about you, along with information about how we use it.

**How to exercise:** Dashboard → Data & Privacy → Subject Access Request, or email privacy@jagroupservices.co.uk.

**Response time:** Within 30 days of a valid request.

---

## 3. Right to Rectification (Article 16)

You have the right to request correction of inaccurate or incomplete personal data.

**How to exercise:** Most data can be updated directly in your dashboard. For data you cannot update yourself, email privacy@jagroupservices.co.uk.

---

## 4. Right to Erasure — "Right to be Forgotten" (Article 17)

You have the right to request deletion of your personal data where:
- The data is no longer necessary for the purpose it was collected
- You withdraw consent (where processing was based on consent)
- You object to processing and there are no overriding legitimate grounds
- The data has been unlawfully processed

**How to exercise:** Dashboard → Account → Close Account, or email privacy@jagroupservices.co.uk.

**Note:** Some data may be retained where we have a legal obligation (e.g. billing records retained for 7 years under UK tax law).

---

## 5. Right to Restriction of Processing (Article 18)

You have the right to request that we restrict processing of your data in certain circumstances, such as while a dispute about accuracy is resolved.

**How to exercise:** Email privacy@jagroupservices.co.uk.

---

## 6. Right to Data Portability (Article 20)

You have the right to receive your personal data in a structured, commonly used, machine-readable format (JSON).

**How to exercise:** Dashboard → Data & Privacy → Export My Data.

---

## 7. Right to Object (Article 21)

You have the right to object to processing of your personal data for direct marketing purposes at any time.

**How to exercise:** Dashboard → Notification Preferences, or email privacy@jagroupservices.co.uk.

---

## 8. Rights Related to Automated Decision-Making (Article 22)

We do not make solely automated decisions that produce legal or similarly significant effects on you.

---

## 9. Response Timescales

We will respond to all rights requests within **30 days**. In complex cases, we may extend this by a further 2 months and will notify you of the extension and the reason.

We will not charge a fee for reasonable requests. We may charge a reasonable fee or refuse manifestly unfounded or excessive requests.

---

## 10. Complaints

If you are not satisfied with how we handle your rights request, you have the right to lodge a complaint with the **Information Commissioner's Office (ICO)**:
- Website: ico.org.uk
- Phone: 0303 123 1113

---

## 11. Contact

**JA Group Services Ltd — Data Protection**
Email: privacy@jagroupservices.co.uk
Website: jagroupservices.co.uk`,
  },
];
// Upsert each policy: insert if missing, update if placeholder OR if forceVersion matches SEED_VERSION
for (const seed of POLICY_SEEDS) {
  const existing = db.prepare('SELECT id, content FROM legal_policies WHERE key = ?').get(seed.key) as
    | { id: number; content: string }
    | undefined;

  const isPlaceholder = !existing || !existing.content || existing.content.trim() === '' || existing.content === 'Coming soon' || existing.content.includes('Content loading from database');
  const isForced = seed.forceVersion === SEED_VERSION;

  if (!existing) {
    db.prepare(`
      INSERT INTO legal_policies (key, title, version, effective_date, content, is_published, last_updated)
      VALUES (?, ?, '1.0', ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(seed.key, seed.title, TODAY, seed.content);
  } else if (isPlaceholder || isForced) {
    db.prepare(`
      UPDATE legal_policies SET title = ?, content = ?, version = '1.0', effective_date = ?, is_published = 1, last_updated = CURRENT_TIMESTAMP WHERE key = ?
    `).run(seed.title, seed.content, TODAY, seed.key);
  }
}

export async function clearAuditLog(_req: Request, res: Response) {
  try {
    db.exec(`DELETE FROM audit_log`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to clear audit log' });
  }
}

export async function getAuditLog(req: Request, res: Response) {
  try {
    const { actor_type, resource_type, action, search, result, limit = '500', offset = '0' } = req.query as Record<string, string>;

    let where = `WHERE 1=1`;
    const params: (string | number)[] = [];

    if (actor_type) { where += ` AND actor_type = ?`; params.push(actor_type); }
    if (resource_type) { where += ` AND resource_type = ?`; params.push(resource_type); }
    if (result) { where += ` AND result = ?`; params.push(result); }
    if (action) { where += ` AND action LIKE ?`; params.push(`%${action}%`); }
    if (search) {
      where += ` AND (actor_name LIKE ? OR actor_email LIKE ? OR action LIKE ? OR resource_label LIKE ? OR details LIKE ? OR tenant LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    const dataQuery = `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as c FROM audit_log ${where}`;

    const dataParams = [...params, parseInt(limit) || 500, parseInt(offset) || 0];
    // better-sqlite3: spread params — do NOT pass as a single array argument
    const entries = db.prepare(dataQuery).all(...dataParams);
    const totalRow = db.prepare(countQuery).get(...params) as { c: number } | undefined;
    const total = totalRow?.c ?? 0;

    res.json({ success: true, data: Array.isArray(entries) ? entries : [], total });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
}

// Legal policies
export async function getLegalPolicies(_req: Request, res: Response) {
  try {
    const rows = await db.prepare('SELECT * FROM legal_policies').all() as {
      key: string; title: string; version: string; effective_date: string;
      content: string; is_published: number; last_updated: string;
    }[];
    const data: Record<string, object> = {};
    for (const row of rows) {
      data[row.key] = { ...row, is_published: row.is_published === 1 };
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch legal policies' });
  }
}

export async function updateLegalPolicy(req: AuthRequest, res: Response) {
  try {
    const { key } = req.params;
    const { title, version, effective_date, content, is_published, last_updated } = req.body;
    const existing = await db.prepare('SELECT id, version FROM legal_policies WHERE key = ?').get(key) as { id: number; version: string } | undefined;
    if (existing) {
      await db.prepare(`
        UPDATE legal_policies SET title=?, version=?, effective_date=?, content=?, is_published=?, last_updated=? WHERE key=?
      `).run(title, version, effective_date, content, is_published ? 1 : 0, last_updated || new Date().toISOString(), key);
    } else {
      await db.prepare(`
        INSERT INTO legal_policies (key, title, version, effective_date, content, is_published, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(key, title, version, effective_date, content, is_published ? 1 : 0, last_updated || new Date().toISOString());
    }

    // When a core policy (terms/privacy) is published with a new version, bump required_consent_version
    // so all users must re-acknowledge on next dashboard visit.
    const isCorePolicy = key === 'terms' || key === 'privacy';
    const versionChanged = !existing || existing.version !== version;
    if (is_published && isCorePolicy && versionChanged) {
      // Build a composite required version string from all published core policy versions
      const terms = db.prepare("SELECT version FROM legal_policies WHERE key='terms' AND is_published=1").get() as { version: string } | undefined;
      const privacy = db.prepare("SELECT version FROM legal_policies WHERE key='privacy' AND is_published=1").get() as { version: string } | undefined;
      const termsV = key === 'terms' ? version : (terms?.version ?? '1.0');
      const privacyV = key === 'privacy' ? version : (privacy?.version ?? '1.0');
      const requiredVersion = `t${termsV}-p${privacyV}`;
      db.prepare(`
        INSERT INTO admin_settings (key, value) VALUES ('required_consent_version', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(requiredVersion);
    }

    if (req.user) {
      writeAudit({
        actorId: req.user.id, actorName: req.user.name, actorEmail: req.user.email,
        actorType: 'admin', action: 'update', resourceType: 'legal_policy',
        resourceId: String(key), resourceLabel: title,
        details: `Updated ${title} to v${version}`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update legal policy' });
  }
}

// Public endpoint — returns published policies
export async function getPublicPolicy(req: Request, res: Response) {
  try {
    const { key } = req.params;
    const policy = await db.prepare('SELECT * FROM legal_policies WHERE key = ? AND is_published = 1').get(key) as {
      key: string; title: string; version: string; effective_date: string;
      content: string; is_published: number; last_updated: string;
    } | undefined;
    if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });
    res.json({ success: true, data: { ...policy, is_published: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch policy' });
  }
}
