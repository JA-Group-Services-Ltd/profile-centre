import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

const routes = read('src/routes.tsx');
const home = read('src/pages/index.tsx');
const about = read('src/pages/about.tsx');
const plansPage = read('src/pages/plans.tsx');
const contact = read('src/pages/contact.tsx');
const planComparison = read('src/components/public/PlanComparison.tsx');
const header = read('src/layouts/parts/HeaderNav.tsx');
const footer = read('src/layouts/parts/Footer.tsx');
const catalogue = read('functions/_shared/catalogue.js');
const profileExport = read('src/components/ProfileExport.tsx');
const dynamicLegal = read('src/pages/legal/DynamicLegalPage.tsx');
const legalDefaults = read('functions/_shared/legal-policies.js');
const publicLegalApi = read('functions/api/legal/[key].js');
const adminLegalApi = read('functions/api/admin/legal.js');
const adminLegalItemApi = read('functions/api/admin/legal/[key].js');
const adminLegalPage = read('src/pages/admin/legal.tsx');
const centralPayments = read('functions/_shared/stripe.js');
const headOffice = read('functions/_shared/head-office.js');
const supportBridge = read('functions/api/customer-service/[[path]].js');
const cloudflareSaas = read('functions/_shared/cloudflare-saas.js');
const apiMiddleware = read('functions/api/_middleware.js');
const profileRoute = read('src/pages/profile.tsx');

const productionHost = 'https://sousamurrayprofiles.jagroupservices.co.uk';
const retiredHost = 'japrofilestudio.jagroupservices.co.uk';

// Named public pages must exist before the single-segment username catch-all.
for (const path of ['/about', '/plans', '/contact']) {
  const namedIndex = routes.indexOf(`path: '${path}'`);
  const catchAllIndex = routes.indexOf("path: '/:seg1'");
  assert.ok(namedIndex >= 0, `${path} public route must exist`);
  assert.ok(catchAllIndex > namedIndex, `${path} must be declared before the public username catch-all`);
}
assert.match(routes, /const AboutPage = lazy/);
assert.match(routes, /const PlansPage = lazy/);
assert.match(routes, /const ContactPage = lazy/);

// Public marketing pages should use the current brand host and real destinations.
for (const [name, source] of Object.entries({ home, about, plansPage, contact })) {
  assert.match(source, /sousamurrayprofiles\.jagroupservices\.co\.uk/, `${name} should use the current production host`);
  assert.doesNotMatch(source, /japrofilestudio\.jagroupservices\.co\.uk/i, `${name} must not use the retired production host`);
}
assert.match(home, /\/api\/homepage-content/);
assert.match(home, /<PlanComparison compact/);
assert.match(about, /Part of Sousa Murray/);
assert.match(contact, /contact@jagroupservices\.co\.uk/);
assert.match(contact, /020 3834 2790/);
assert.match(plansPage, /<PlanComparison/);
assert.match(planComparison, /\/api\/plans/);
assert.match(planComparison, /Detailed plan comparison/);

// Navigation must expose the new public information architecture.
for (const route of ['/about', '/plans', '/contact']) {
  assert.match(header, new RegExp(route.replace('/', '\\/')));
  assert.match(footer, new RegExp(route.replace('/', '\\/')));
}
assert.match(footer, /16314179/);
assert.match(footer, /ZB877370/);

// Public catalogue must not leak active-but-private plans.
assert.match(catalogue, /COALESCE\(p\.is_public, 1\) = 1/);
const freeBlock = catalogue.match(/free:\s*\[[\s\S]*?\],\n\s*starter:/)?.[0] || '';
const starterBlock = catalogue.match(/starter:\s*\[[\s\S]*?\],\n\s*professional:/)?.[0] || '';
for (const block of [freeBlock, starterBlock]) {
  assert.match(block, /Social profile sharing/);
  assert.match(block, /Website embed code/);
}

// Sharing and embeds must be plan-neutral and safe for Free/Starter.
for (const label of ['Facebook', 'Instagram', 'Snapchat', 'WhatsApp', 'Messenger']) {
  assert.match(profileExport, new RegExp(label));
}
assert.match(profileExport, /navigator\.share/);
assert.match(profileExport, /facebook\.com\/sharer/);
assert.match(profileExport, /wa\.me/);
assert.match(profileExport, /<iframe src=/);
assert.match(profileExport, /Available on Free, Starter and all higher plans/);
assert.match(profileExport, /function escapeHtml/);
assert.match(profileExport, /normaliseWebUrl/);
assert.doesNotMatch(profileExport, /japrofilestudio\.jagroupservices\.co\.uk/i);

// Legal public and Admin pages must use one complete API contract.
for (const key of [
  'terms', 'privacy', 'cookies', 'acceptable_use', 'refunds', 'complaints',
  'accessibility', 'eligibility', 'data_retention', 'reporting', 'security', 'data_rights',
]) {
  assert.match(legalDefaults, new RegExp(`${key}:\\s*policy\\(`), `default legal policy missing: ${key}`);
}
assert.match(legalDefaults, /16314179/);
assert.match(legalDefaults, /ZB877370/);
assert.match(legalDefaults, /VERSION = "2\.0"/);
assert.match(publicLegalApi, /getLegalPolicy/);
assert.match(adminLegalApi, /requireAdmin/);
assert.match(adminLegalApi, /getLegalPolicyAdminCollection/);
assert.match(adminLegalItemApi, /requireAdmin/);
assert.match(adminLegalItemApi, /saveLegalPolicy/);
assert.match(adminLegalPage, /\/api\/admin\/legal/);
assert.match(dynamicLegal, /\/api\/legal\//);
assert.match(dynamicLegal, /sanitiseLegacyHtml/);
assert.match(dynamicLegal, /script,iframe,object,embed/);
assert.match(dynamicLegal, new RegExp(productionHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(dynamicLegal, new RegExp(retiredHost.replaceAll('.', '\\.')));

// Central Payments must prefer the dedicated scoped payment credential.
const dedicatedKey = centralPayments.indexOf('CENTRAL_PAYMENTS_API_KEY');
const customerOpsKey = centralPayments.indexOf('CUSTOMEROPS_API_KEY');
const legacyPlatformKey = centralPayments.indexOf('HEAD_OFFICE_PLATFORM_KEY');
assert.ok(dedicatedKey >= 0 && customerOpsKey > dedicatedKey && legacyPlatformKey > customerOpsKey,
  'Central Payments credential priority must be dedicated payment key -> CustomerOps fallback -> legacy platform fallback');
for (const endpoint of [
  '/api/v1/payments/account-info',
  '/api/v1/payments/status',
  '/api/v1/payments/checkout',
  '/api/v1/payments/portal',
  '/api/v1/payments/subscription',
]) assert.ok(centralPayments.includes(endpoint), `Central Payments endpoint missing: ${endpoint}`);
assert.match(centralPayments, /AbortController/);
assert.match(centralPayments, /12_000/);
assert.match(centralPayments, /must use HTTPS/);

// Customer/security Head Office connector must remain a separate scoped credential.
assert.match(headOffice, /HEAD_OFFICE_PLATFORM_KEY/);
assert.match(headOffice, /https:\/\/customerops\.jagroupservices\.co\.uk/);
assert.match(headOffice, /HEAD_OFFICE_TIMEOUT_MS = 12_000/);
assert.match(headOffice, /head_office_timeout/);
assert.match(headOffice, /verifyStripeAccount/);
assert.match(headOffice, /centralPayments: paymentsHealthy/);
assert.doesNotMatch(headOffice, /authorization: `Bearer \$\{.*CENTRAL_PAYMENTS_API_KEY/);

// Customer Service bridge keeps its own controlled bridge and secure timeout.
assert.match(supportBridge, /CUSTOMEROPS_API_KEY/);
assert.match(supportBridge, /sameOrigin/);
assert.match(supportBridge, /10_000/);
assert.match(supportBridge, /must use HTTPS/);
assert.match(supportBridge, /64_000/);

// Cloudflare SaaS custom-domain connector must fail closed and time out.
assert.match(cloudflareSaas, /CLOUDFLARE_SAAS_API_TOKEN/);
assert.match(cloudflareSaas, /CLOUDFLARE_SAAS_ZONE_ID/);
assert.match(cloudflareSaas, /REQUEST_TIMEOUT_MS = 12_000/);
assert.match(cloudflareSaas, /cloudflare_saas_timeout/);
assert.match(cloudflareSaas, /AbortController/);

// Existing production protections from the previous profile-save repair stay wired in.
assert.match(apiMiddleware, /x-frame-options/i);
assert.match(routes, /SiteStatusGate/);
assert.match(profileRoute, /profile/i);

console.log('Full Sousa Murray Profiles public, customer, admin, legal, sharing and integration contract checks passed.');
