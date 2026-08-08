import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";

export const LEGAL_POLICY_KEYS = Object.freeze([
  "terms",
  "privacy",
  "cookies",
  "acceptable_use",
  "refunds",
  "complaints",
  "accessibility",
  "eligibility",
  "data_retention",
  "reporting",
  "security",
  "data_rights",
]);

const EFFECTIVE_DATE = "2026-08-08";
const VERSION = "2.0";
const COMPANY = "JA Group Services Ltd";
const SERVICE = "Sousa Murray Profiles";
const CONTACT = "contact@jagroupservices.co.uk";
const ADDRESS = "167–169 Great Portland Street, 5th Floor, London W1W 5PF, United Kingdom";

function policy(title, content) {
  return Object.freeze({
    title,
    version: VERSION,
    effective_date: EFFECTIVE_DATE,
    content: content.trim(),
    is_published: true,
    last_updated: `${EFFECTIVE_DATE}T00:00:00.000Z`,
  });
}

export const DEFAULT_LEGAL_POLICIES = Object.freeze({
  terms: policy("Terms of Service", `
# Terms of Service

These Terms govern business and professional use of **${SERVICE}**, a digital profile service operated by **${COMPANY}** (company number 16314179) from ${ADDRESS}.

## 1. Who the service is for

${SERVICE} is offered for business, trade, professional and organisational use, including sole traders and self-employed customers. Account holders must be at least 18 years old and satisfy any eligibility requirements shown during registration.

If mandatory rights apply to you by law despite the business purpose of the service, nothing in these Terms removes those rights.

## 2. Your account

You must provide accurate information, keep your sign-in details secure and promptly tell us if you suspect unauthorised access. Authentication may be provided through JA Group Services ID and connected identity services.

You are responsible for activity carried out through your account unless it results from a failure for which we are legally responsible.

## 3. Profiles and content

You remain responsible for the text, images, links, files and other material you publish. You must have the right to use that material and must not publish content that is unlawful, misleading, defamatory, abusive, fraudulent, infringing, malicious or likely to compromise another person's privacy or security.

Public profiles are designed to be shared publicly. Do not put information on a public profile that you do not want visitors to see.

You grant ${COMPANY} a limited, non-exclusive licence to host, process, reproduce and display your content only as needed to provide, secure and support the service.

## 4. Plans, features and fair use

Features, limits and entitlements depend on the plan attached to your account. The current public plan comparison forms part of the service description. We may introduce reasonable technical limits to protect security, availability and other customers.

Free features may be changed or withdrawn on reasonable notice where practical. Paid features remain subject to the plan and billing terms in force for your subscription.

## 5. Charges and subscriptions

Where a paid subscription is available, the price and billing period are shown before checkout. Payments are processed through JA Group Services Ltd's central payment services and its payment provider.

Subscriptions continue for the stated billing period until cancelled. Cancelling normally stops renewal at the end of the current paid period unless we expressly confirm an earlier date. You remain responsible for charges properly incurred before cancellation.

See our **Refund Policy** for billing errors, duplicate charges and refund requests.

## 6. Sharing, embeds and third-party services

You may share a public profile link, QR code or approved embed code. Social networks, browsers, website builders, payment providers, domain providers and other third-party services have their own terms and availability. We are not responsible for a third party changing or withdrawing its service.

You must not frame or embed ${SERVICE} in a way that is deceptive, unlawful, unsafe or suggests an endorsement that does not exist.

## 7. Custom domains

Where your plan includes a custom-domain feature, you are responsible for having authority to use the domain and for maintaining any registration or DNS arrangements that remain your responsibility. We may refuse or disconnect a domain that creates a legal, security or abuse risk.

## 8. Suspension and termination

We may restrict, suspend or terminate access where reasonably necessary to deal with non-payment, security risk, fraud, unlawful activity, serious or repeated policy breaches, legal obligations or threats to the service. Where appropriate, we will explain the reason and provide a route to contact us.

You may close your account using the available account controls, subject to retention required for legal, security, accounting, dispute or fraud-prevention purposes.

## 9. Availability and changes

We work to keep ${SERVICE} available and secure, but internet services can experience maintenance, outages and third-party failures. Unless a separate written service level commitment applies, we do not promise uninterrupted or error-free availability.

We may update features where reasonably necessary for security, legal compliance, technical operation or service improvement.

## 10. Intellectual property

${COMPANY} and its licensors retain rights in the platform, software, service design, documentation and brand material. These Terms do not transfer ownership of those rights to you.

## 11. Liability

Nothing in these Terms excludes or limits liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation.

Subject to that, to the extent permitted by law, neither party is responsible for indirect or consequential loss that was not reasonably foreseeable. Any further limitation applying to a paid business account will be interpreted fairly and in accordance with applicable law and any separately agreed order terms.

## 12. Governing law

These Terms are governed by the law of England and Wales. The courts of England and Wales will have jurisdiction, subject to any mandatory rule that requires otherwise.

## 13. Contact

Questions about these Terms can be sent to **${CONTACT}**. Complaints can be raised under our Complaints Policy.
  `),

  privacy: policy("Privacy Policy", `
# Privacy Policy

This Privacy Policy explains how **${COMPANY}** uses personal data when operating **${SERVICE}**. ${COMPANY} is registered with the Information Commissioner's Office under registration **ZB877370**.

## 1. Data controller

For the processing described in this notice, the controller is **${COMPANY}**, company number 16314179, ${ADDRESS}. Contact: **${CONTACT}**.

In some business arrangements a customer organisation may itself be a controller for information it chooses to publish or manage through the service. Where we act only on that organisation's documented instructions, the relevant contract may set out additional processor terms.

## 2. Information we may collect

Depending on how you use the service, we may process:

- account information such as name, business email, contact details and account identifiers;
- JA Group Services ID and identity-provider identifiers needed for sign-in and account security;
- profile information that you choose to publish, including photographs, job or business details, contact links and social links;
- organisation, team and seat information;
- subscription, invoice and payment-reference information. We do not need to store your full card number when payment is handled by our payment provider;
- support, complaint, enquiry and service-communication records;
- security, audit, device, session, IP and fraud-prevention information;
- custom-domain and technical configuration information;
- usage and diagnostic information where permitted by law and your choices.

## 3. How we use personal data

We use personal data to:

- create, authenticate and administer accounts;
- publish and deliver profiles at your request;
- provide organisation, sharing, QR, embed, billing, domain and support features;
- process subscriptions and maintain accounting records;
- protect customers, investigate abuse, prevent fraud and maintain security;
- respond to enquiries, complaints and data-rights requests;
- comply with legal, regulatory and contractual obligations;
- improve reliability and service design using appropriately controlled diagnostic information.

## 4. Lawful bases

The lawful basis depends on the purpose. We may rely on:

- **contract** where processing is needed to provide the service you requested;
- **legitimate interests** for proportionate service security, fraud prevention, business administration and service improvement, after considering individual rights;
- **legal obligation** where records or disclosures are required by law;
- **consent** where the law requires consent, for example for certain non-essential storage/access technologies or optional marketing.

You can withdraw consent at any time where consent is the basis, without affecting earlier lawful processing.

## 5. Public profile information

Information you publish on a public profile can be viewed and shared by other people and may be indexed or cached by third parties. Review your profile carefully before publishing it. Removing information from ${SERVICE} cannot guarantee immediate removal of copies held independently by other people, search engines or social networks.

## 6. Who we share information with

We may use carefully selected service providers for hosting, identity, payments, communications, security, support, analytics or other technical functions. We only provide information reasonably needed for their role and use contractual or other safeguards where required.

We may also disclose information where required by law, to protect legal rights or security, during a legitimate corporate transaction, or at your direction.

## 7. International transfers

Some suppliers may process information outside the United Kingdom. Where UK data-protection law requires a transfer safeguard, we use an applicable adequacy regulation, approved contractual safeguard or another lawful transfer mechanism, together with supplementary measures where appropriate.

## 8. Retention

We keep information only for as long as reasonably necessary for the purpose for which it was collected, including account operation, legal obligations, accounting, fraud prevention, dispute handling and security. More detail is set out in our **Data Retention Policy**.

## 9. Security

We use technical and organisational controls designed to protect personal data, including controlled access, authenticated administrative functions, encrypted network transport, audit records and security monitoring. No internet service can guarantee absolute security.

## 10. Your rights

Depending on the circumstances, UK data-protection law may give you rights of access, rectification, erasure, restriction, objection and data portability, and rights relating to certain automated decisions. See our **Data Subject Rights** page for how to exercise them.

## 11. Complaints to the ICO

Please contact us first if you have a data-protection concern so we can investigate it. You also have the right to complain to the UK Information Commissioner's Office.

## 12. Changes

We may update this notice when our service, suppliers or legal obligations change. The version and effective date shown on this page identify the published notice that applies.

## 13. Contact

Privacy questions and data-rights requests can be sent to **${CONTACT}**.
  `),

  cookies: policy("Cookie and Storage Technologies Policy", `
# Cookie and Storage Technologies Policy

This policy explains how **${SERVICE}** uses cookies and similar storage or access technologies.

## 1. What these technologies are

Cookies and similar technologies can store or access information on your browser or device. They may be used for sign-in, security, preferences, service operation, analytics and other functions.

## 2. Strictly necessary technologies

We may use strictly necessary technologies without optional consent where they are required to provide a service you requested or to protect essential service security. Examples can include authentication sessions, security state, load balancing and fraud-prevention controls.

Blocking strictly necessary technology may stop sign-in or other core features from working.

## 3. Optional technologies

Where consent is required by UK law, non-essential technologies are not intentionally activated until an appropriate choice has been made. Optional categories may include analytics, experience measurement or other non-essential functions if and when enabled.

Consent must be a genuine choice. You can change or withdraw an optional choice using the available cookie/privacy controls where those technologies are in use.

## 4. Third-party services

Connected services may set or read information when you actively use them, for example an identity, embedded content or payment service. Their own privacy information may also apply.

## 5. Managing cookies

Most browsers let you view, delete or block cookies. Browser controls are separate from any consent controls provided by ${SERVICE}. Blocking all cookies may prevent essential features from working.

## 6. Keeping the list accurate

The exact technologies used can change as the platform changes. We review this policy and our consent controls when adding or materially changing non-essential technologies.

## 7. Contact

Questions about cookies or similar technologies can be sent to **${CONTACT}**.
  `),

  acceptable_use: policy("Acceptable Use Policy", `
# Acceptable Use Policy

This policy protects customers, visitors and the integrity of **${SERVICE}**.

## You must not use the service to

- break the law or encourage unlawful activity;
- impersonate another person or organisation in a deceptive or fraudulent way;
- publish material that you do not have the right to use;
- harass, threaten, defame or unlawfully discriminate against another person;
- publish malicious code, credential-harvesting pages, phishing material or links intended to compromise a device or account;
- distribute spam or use profiles primarily for unsolicited bulk messaging;
- facilitate fraud, scams, money laundering or deceptive commercial practices;
- expose personal data about another person without an appropriate lawful basis or authority;
- attempt to bypass access controls, rate limits, plan limits or security measures;
- probe, scan or attack the platform except through an expressly authorised security-testing programme;
- interfere with availability, scrape the service at unreasonable scale or place excessive automated load on it;
- use a custom domain or embed in a way that misleads visitors about who operates a profile.

## Moderation and enforcement

We may investigate reports, restrict visibility, remove material, suspend functions or accounts, preserve evidence and make disclosures where legally required or reasonably necessary to protect security and rights.

We aim to act proportionately. Serious fraud, security threats, illegal content or repeated violations may justify immediate action.

## Reporting concerns

Use our Reporting & Moderation process or contact **${CONTACT}** if a profile appears to breach this policy.
  `),

  refunds: policy("Refund and Cancellation Policy", `
# Refund and Cancellation Policy

This policy explains how subscription cancellations, billing mistakes and refund requests are handled for **${SERVICE}**.

## 1. Business service

${SERVICE} is supplied for business and professional use. Prices and the billing period are shown before a paid order is confirmed. Nothing in this policy limits any mandatory legal right that applies in a particular case.

## 2. Cancelling a subscription

You can request cancellation using the billing controls available in your account. Unless we confirm otherwise, cancellation takes effect at the end of the current paid billing period and stops the next renewal.

## 3. When we will investigate a refund

Please contact us promptly if you believe there has been:

- a duplicate charge;
- a charge made after a cancellation should have taken effect;
- an incorrect amount charged by us;
- an unauthorised payment connected to your account;
- a material service or billing error for which a refund may be an appropriate remedy.

We may ask for information needed to identify the transaction and investigate the request.

## 4. Change of mind

Because this is a business/professional digital service, a refund is not automatically due merely because a customer changes their mind after a paid period has begun, unless an applicable law or a specific written offer says otherwise.

## 5. Processing approved refunds

Approved refunds are sent through the payment route used for the transaction where possible. The receiving bank or payment provider controls how quickly an approved refund appears after it is submitted.

## 6. Disputes

Contact us before raising a payment dispute where practical so we can investigate quickly. This does not prevent you from using a lawful dispute or complaint process available to you.

## 7. Contact

Billing and refund requests can be sent to **${CONTACT}** or raised through your support account.
  `),

  complaints: policy("Complaints Policy", `
# Complaints Policy

We want complaints about **${SERVICE}** to be handled clearly, fairly and with an audit trail.

## 1. How to complain

You can contact **${CONTACT}** or use the support tools in your account. Please include your name or organisation, relevant account/profile information, what happened, when it happened and the outcome you are seeking.

## 2. What happens next

We will record the complaint, identify the appropriate team or responsible person, investigate relevant account and service records, and provide a response or progress update as soon as reasonably practical.

Complex security, payment, data-protection or third-party matters can take longer because evidence may need to be obtained or preserved.

## 3. Review and escalation

If you remain dissatisfied, tell us why and ask for the complaint to be reviewed. A review should consider the original decision, relevant evidence and whether the policy or process was followed correctly.

## 4. Data-protection complaints

Privacy complaints can also be made to the Information Commissioner's Office. We recommend contacting us first so we have the opportunity to investigate and resolve the concern.

## 5. Records

Complaint records are retained in line with our Data Retention Policy and may be used to identify recurring service problems and improve controls.
  `),

  accessibility: policy("Accessibility Statement", `
# Accessibility Statement

**${COMPANY}** wants **${SERVICE}** to be usable by as many people as reasonably possible, including people who use assistive technologies or need clearer, simpler interfaces.

## Our approach

We aim to design and maintain the public website, customer dashboard and key service journeys with recognised accessibility practice in mind, including the principles of **WCAG 2.2 Level AA** where reasonably applicable.

This is an ongoing engineering commitment rather than a claim that every page or third-party component is perfect at all times.

## Features we work to support

- keyboard navigation and visible focus states;
- semantic headings, labels and form controls;
- sufficient contrast and adaptable text;
- meaningful alternative text where images convey information;
- responsive layouts and support for browser zoom;
- clear validation and error messages;
- reduced reliance on colour alone to communicate meaning.

## Third-party content

Some connected services, customer-supplied content or external websites are outside our direct control. We still welcome reports where a third-party integration creates a barrier inside our service.

## Tell us about a problem

If you cannot access part of ${SERVICE}, contact **${CONTACT}** and tell us the page, task and assistive technology or browser involved if you are comfortable doing so. We will use that information to investigate and, where reasonable, provide an alternative or make an improvement.
  `),

  eligibility: policy("Eligibility Policy", `
# Eligibility Policy

This policy explains who may open and operate a **${SERVICE}** account.

## 1. Age

Account holders must be **18 or over**. We may request reasonable age or identity assurance where required for security, legal compliance or risk management.

## 2. Business and professional purpose

The service is intended for business, trade, self-employed, professional, club and organisational use. You must have authority to create an account or profile for any organisation you represent.

## 3. Location and availability

The service is principally offered by a UK company and may limit account registration or particular features by territory, supplier availability, legal requirement or risk. Public profiles can be viewed from other countries unless access is restricted.

## 4. Accurate information

You must provide accurate registration information and keep material account details current. We may pause verification-sensitive functions while conflicting or incomplete identity information is reviewed.

## 5. Refusal or restriction

We may refuse, restrict or close an account where we reasonably identify fraud, sanctions or legal restrictions, material policy breaches, impersonation, security risk or lack of authority to represent an organisation.

Questions about eligibility can be sent to **${CONTACT}**.
  `),

  data_retention: policy("Data Retention Policy", `
# Data Retention Policy

We keep personal data and business records only for as long as reasonably necessary for an identified purpose.

## Retention approach

Retention periods depend on the type of information, why it is used, legal and accounting requirements, security needs, disputes and whether an account remains active.

## Typical categories

- **Active account and profile data:** normally kept while the account is active and needed to provide the service.
- **Deleted or closed account data:** removed or anonymised after closure where it is no longer required, subject to backup cycles and justified legal, fraud, security or dispute holds.
- **Payment and accounting records:** retained for the period required by tax, accounting and company-law obligations.
- **Security and audit records:** retained for a proportionate period needed to detect abuse, investigate incidents and demonstrate control of the service.
- **Support and complaint records:** retained long enough to resolve the matter, manage repeat issues and meet legal or evidential requirements.
- **Consent and policy records:** may be kept to demonstrate the choices and legal information that applied at a particular time.

## Backups

Information deleted from the live service may remain in protected backups until the relevant backup is securely overwritten or expires. Backups are not intended to be used as an active customer record after deletion.

## Legal holds

We may preserve specific information for longer where reasonably necessary for litigation, a complaint, fraud investigation, security incident, regulatory request or other legal obligation.

For a retention question about your own information, contact **${CONTACT}**.
  `),

  reporting: policy("Reporting and Moderation Policy", `
# Reporting and Moderation Policy

Public profiles can be reported when they appear to contain unlawful, fraudulent, abusive, infringing or otherwise prohibited material.

## 1. Making a report

Use the available report function or contact **${CONTACT}**. Give the profile URL, the content you are concerned about, why you believe it breaches law or policy, and any useful supporting information.

Do not send unnecessary sensitive personal information.

## 2. Assessment

We may review the reported content, relevant account records and previous reports. We may contact the reporter or account holder for clarification where appropriate.

## 3. Action we may take

Depending on seriousness and evidence, we may take no action, request a change, limit visibility, remove content, suspend a profile or account, preserve evidence, or make a legally required disclosure.

Immediate restriction may be appropriate for credible fraud, phishing, malware, serious threats, unlawful impersonation or other urgent harm.

## 4. Fairness and abuse of reporting

A report does not automatically prove a violation. We aim to consider context and available evidence. Knowingly false, malicious or repetitive abusive reports may themselves breach our Acceptable Use Policy.

## 5. Review

Where appropriate and legally permitted, an affected account holder may ask us to review a moderation decision by contacting support and providing relevant evidence.
  `),

  security: policy("Security Policy", `
# Security Policy

Protecting customer accounts and operational systems is a core requirement of **${SERVICE}**.

## Security controls

Our security programme is designed around layered controls. Depending on the system and risk, these may include:

- authenticated access and role-based administrative permissions;
- central customer/security authority controls operated by ${COMPANY};
- encrypted network connections;
- protected secret and environment-variable storage rather than embedding service credentials in public website code;
- audit and operational-event records;
- session, access and abuse controls;
- security headers, validation, rate limiting and fail-closed behaviour for sensitive functions;
- separate scoped credentials for sensitive integrations such as central payments;
- incident investigation and recovery procedures.

We do not publish secret values or operational details that would weaken those controls.

## Your responsibilities

Use strong security on your identity account, keep your devices updated, do not share sign-in credentials, review unexpected account activity and contact us promptly if you suspect compromise.

## Security incidents

We investigate credible security incidents and take containment, recovery, notification and evidence-preservation steps appropriate to the risk and applicable law.

## Vulnerability reports

If you believe you have found a security weakness, do not exploit it or access data that is not yours. Send enough information for us to understand and reproduce the issue to **${CONTACT}** with the subject **Security vulnerability report**.
  `),

  data_rights: policy("Data Subject Rights", `
# Data Subject Rights

UK data-protection law gives individuals rights over their personal data. The right that applies depends on the circumstances and lawful basis for processing.

## Rights may include

- **Access:** ask for a copy of personal data we hold about you and related information.
- **Rectification:** ask us to correct inaccurate or incomplete personal data.
- **Erasure:** ask us to delete personal data where the legal conditions are met.
- **Restriction:** ask us to limit certain processing in defined circumstances.
- **Objection:** object to processing based on legitimate interests or certain direct marketing.
- **Portability:** receive certain information you provided in a structured, commonly used, machine-readable format where the legal conditions apply.
- **Withdraw consent:** where processing relies on consent, withdraw it for future processing.
- **Automated decisions:** obtain protections where a legally significant decision is made solely by qualifying automated processing.

## How to make a request

Contact **${CONTACT}** and describe the right you want to exercise. We may need reasonable information to verify identity and locate the relevant account, particularly where disclosure or deletion could affect security or another person.

We do not charge a fee in ordinary cases. The law allows different treatment of requests that are manifestly unfounded or excessive.

## Timescales and exemptions

We aim to respond within the period required by applicable law. Some rights are subject to exemptions, competing legal obligations or the rights of other people. If we cannot fully comply, we will explain the position where the law permits.

## Complaints

You can complain about our handling of personal data to the Information Commissioner's Office. You can also use our Complaints Policy so we can investigate the matter directly.
  `),
});

function ensureKey(key) {
  const normalised = String(key || "").trim().toLowerCase().replace(/-/g, "_");
  if (!LEGAL_POLICY_KEYS.includes(normalised)) {
    throw new HttpError(404, "Legal policy not found.", "legal_policy_not_found");
  }
  return normalised;
}

export function defaultLegalPolicy(key) {
  return DEFAULT_LEGAL_POLICIES[ensureKey(key)];
}

async function tableColumns(database) {
  const result = await database.prepare("PRAGMA table_info(legal_policies)").all();
  return new Set((result.results || []).map((column) => String(column.name)));
}

export async function ensureLegalPoliciesSchema(database) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS legal_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0',
      effective_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const columns = await tableColumns(database);
  const additions = [
    ["effective_date", "TEXT"],
    ["is_active", "INTEGER NOT NULL DEFAULT 1"],
    ["last_updated", "TEXT"],
  ];
  for (const [name, definition] of additions) {
    if (!columns.has(name)) {
      await database.prepare(`ALTER TABLE legal_policies ADD COLUMN ${name} ${definition}`).run();
    }
  }
}

function normaliseRow(row, key) {
  const fallback = DEFAULT_LEGAL_POLICIES[key];
  if (!row) return { ...fallback, key };
  return {
    key,
    title: String(row.title || fallback.title),
    version: String(row.version || fallback.version),
    effective_date: String(row.effective_date || row.last_updated || fallback.effective_date).slice(0, 10),
    content: String(row.content || fallback.content),
    is_published: Number(row.is_active ?? 1) === 1,
    last_updated: String(row.last_updated || fallback.last_updated),
  };
}

export async function getLegalPolicy(database, rawKey) {
  const key = ensureKey(rawKey);
  await ensureLegalPoliciesSchema(database);
  const row = await database.prepare(`
    SELECT * FROM legal_policies WHERE key=?1 AND COALESCE(is_active,1)=1 LIMIT 1
  `).bind(key).first();
  return normaliseRow(row, key);
}

export async function getLegalPolicyAdminCollection(database) {
  await ensureLegalPoliciesSchema(database);
  const result = await database.prepare("SELECT * FROM legal_policies ORDER BY id ASC").all();
  const byKey = new Map((result.results || []).map((row) => [String(row.key), row]));
  return Object.fromEntries(LEGAL_POLICY_KEYS.map((key) => [key, normaliseRow(byKey.get(key), key)]));
}

export async function saveLegalPolicy(request, database, admin, rawKey) {
  const key = ensureKey(rawKey);
  await ensureLegalPoliciesSchema(database);
  const body = await readJson(request);
  const fallback = DEFAULT_LEGAL_POLICIES[key];
  const title = String(body.title || fallback.title).trim().slice(0, 180);
  const version = String(body.version || fallback.version).trim().slice(0, 40);
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.effective_date || ""))
    ? String(body.effective_date)
    : fallback.effective_date;
  const content = String(body.content || "").trim();
  const isActive = body.is_published === false || body.is_active === false ? 0 : 1;
  if (!title || !content) throw new HttpError(400, "Policy title and content are required.", "validation_error");

  await database.prepare(`
    INSERT INTO legal_policies (key,title,content,version,effective_date,is_active,last_updated)
    VALUES (?1,?2,?3,?4,?5,?6,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      title=excluded.title,
      content=excluded.content,
      version=excluded.version,
      effective_date=excluded.effective_date,
      is_active=excluded.is_active,
      last_updated=CURRENT_TIMESTAMP
  `).bind(key, title, content, version, effectiveDate, isActive).run();

  await writeAudit(database, request, admin, "update", "legal_policy", `Updated legal policy ${key}`);
  const row = await database.prepare("SELECT * FROM legal_policies WHERE key=?1 LIMIT 1").bind(key).first();
  return normaliseRow(row, key);
}
