import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

const pin = read('functions/_shared/public-profile-pin.js');
const interactions = read('functions/_shared/profile-interactions.js');
const publicProfile = read('functions/api/profiles/[username]/public.js');
const publicPinVerify = read('functions/api/profiles/[username]/public-pin/verify.js');
const ownerPin = read('functions/api/profiles/[id]/public-pin.js');
const ownerPinStatus = read('functions/api/profiles/[id]/pin/status.js');
const ownerEnquiryToggle = read('functions/api/profiles/[id]/enquiry.js');
const analyticsView = read('functions/api/analytics/view/[username].js');
const analyticsOwner = read('functions/api/analytics/[id].js');
const linkClick = read('functions/api/links/[id]/click.js');
const publicEnquiry = read('functions/api/enquiries/[username].js');
const ownerEnquiries = read('functions/api/enquiries.js');
const enquiryRead = read('functions/api/enquiries/[id]/read.js');
const publicReport = read('functions/api/profiles/[username]/report.js');
const verification = read('functions/api/profiles/[id]/request-verification.js');
const qrOwner = read('functions/api/qr/[id].js');
const qrPerson = read('functions/api/qr/[id]/person.js');
const qrPublic = read('functions/api/qr/public/[username].js');
const profilePage = read('src/pages/profile.tsx');
const dashboardProfile = read('src/pages/dashboard/profile.tsx');
const adminProfiles = read('src/pages/admin/profiles.tsx');

// Public profile PIN must be enforced server-side, not just represented in the UI.
assert.match(pin, /bcryptjs/);
assert.match(pin, /SALT_ROUNDS = 12/);
assert.match(pin, /MAX_ATTEMPTS = 8/);
assert.match(pin, /LOCKOUT_MS = 15 \* 60 \* 1000/);
assert.match(pin, /profile_public_pin_unlocks/);
assert.match(pin, /profile_public_pin_attempts/);
assert.match(pin, /Secure; HttpOnly; SameSite=Lax/);
assert.match(pin, /crypto\.getRandomValues/);
assert.match(pin, /crypto\.subtle\.digest/);
assert.match(pin, /public_pin_hash/);
assert.match(pin, /public_pin_locked/);
assert.match(publicProfile, /getPublicProfileGate/);
assert.match(publicProfile, /isPublicProfileUnlocked/);
assert.match(publicProfile, /public_pin_required/);
assert.match(publicPinVerify, /verifyPublicProfilePin/);
assert.match(publicPinVerify, /set-cookie/);

// Profile owner controls must require the authenticated customer and ownership checks.
for (const route of [ownerPin, ownerPinStatus, ownerEnquiryToggle, analyticsOwner, ownerEnquiries, enquiryRead, verification, qrOwner, qrPerson]) {
  assert.match(route, /requireUser/);
}
assert.match(ownerPin, /managePublicProfilePin/);
assert.match(ownerPinStatus, /publicProfileFeatureStatus/);
assert.match(ownerEnquiryToggle, /setPublicProfileEnquiry/);

// Public interactions must use dedicated, resilient Cloudflare/D1 services.
assert.match(interactions, /profile_interaction_events/);
assert.match(interactions, /public_interaction_rate_limits/);
assert.match(interactions, /contact_enquiries/);
assert.match(interactions, /issue_reports/);
assert.match(interactions, /verification_requested_at/);
assert.match(interactions, /recordProfileView/);
assert.match(interactions, /recordLinkClick/);
assert.match(interactions, /getProfileAnalytics/);
assert.match(interactions, /createPublicEnquiry/);
assert.match(interactions, /createProfileReport/);
assert.match(interactions, /requestProfileVerification/);
assert.match(interactions, /QRCode\.toDataURL/);
assert.match(interactions, /ENQUIRY_LIMIT = 5/);
assert.match(interactions, /REPORT_LIMIT = 5/);
assert.match(interactions, /enforcePublicAccess/);
assert.match(interactions, /isPublicProfileUnlocked/);

assert.match(analyticsView, /recordProfileView/);
assert.match(analyticsOwner, /getProfileAnalytics/);
assert.match(linkClick, /recordLinkClick/);
assert.match(publicEnquiry, /createPublicEnquiry/);
assert.match(ownerEnquiries, /listCustomerEnquiries/);
assert.match(enquiryRead, /markCustomerEnquiryRead/);
assert.match(publicReport, /createProfileReport/);
assert.match(verification, /requestProfileVerification/);
assert.match(qrOwner, /createProfileQr/);
assert.match(qrPerson, /createProfileQr/);
assert.match(qrPublic, /createPublicProfileQr/);

// Runtime profile data and production URLs must remain safe/current.
assert.match(profilePage, /if \(Array\.isArray\(value\)\) return value/);
assert.match(profilePage, /safeExternalUrl/);
assert.match(profilePage, /safeImageUrl/);
assert.doesNotMatch(profilePage, /dangerouslySetInnerHTML/);
for (const source of [profilePage, dashboardProfile, adminProfiles]) {
  assert.doesNotMatch(source, /japrofilestudio\.jagroupservices\.co\.uk/i);
}
assert.match(profilePage, /sousamurrayprofiles\.jagroupservices\.co\.uk/);

console.log('Profile PIN, analytics, enquiry, reporting, QR and verification contracts passed.');
