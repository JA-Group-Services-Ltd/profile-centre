import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

const profileOps = read('functions/_shared/admin-profile-operations.js');
const reportOps = read('functions/_shared/admin-issue-reports.js');
const profileCollection = read('functions/api/admin/profiles.js');
const profileDetail = read('functions/api/admin/profiles/[id].js');
const profileAction = read('functions/api/admin/profiles/[id]/[action].js');
const profileActionCompat = read('functions/api/admin/profiles/[id]/action.js');
const reportCollection = read('functions/api/admin/issue-reports.js');
const reportDetail = read('functions/api/admin/issue-reports/[id].js');
const reportAction = read('functions/api/admin/issue-reports/[id]/[action].js');
const reportActionCompat = read('functions/api/admin/issue-reports/[id]/action.js');
const reportStatus = read('functions/api/admin/issue-reports/[id]/status.js');
const reportAssign = read('functions/api/admin/issue-reports/[id]/assign.js');
const reportScan = read('functions/api/admin/issue-reports/[id]/scan.js');

for (const route of [
  profileCollection, profileDetail, profileAction, profileActionCompat,
  reportCollection, reportDetail, reportAction, reportActionCompat,
  reportStatus, reportAssign, reportScan,
]) {
  assert.match(route, /requireAdmin/, 'Every Admin moderation route must require an authenticated Admin session.');
}

assert.match(profileOps, /listAdminProfiles/);
assert.match(profileOps, /open_report_count/);
assert.match(profileOps, /verification_requested_at/);
assert.match(profileOps, /writeAudit/);
for (const action of ['verify', 'unverify', 'publish', 'unpublish', 'hide', 'suspend', 'restore', 'reinstate']) {
  assert.match(profileOps, new RegExp(`"${action}"`));
}
assert.match(profileOps, /verified_at=CURRENT_TIMESTAMP/);
assert.match(profileOps, /verification_requested_at=NULL/);

assert.match(reportOps, /listAdminIssueReports/);
assert.match(reportOps, /reported_profile_id/);
assert.match(reportOps, /reported_user_id/);
assert.match(reportOps, /writeAudit/);
for (const status of ['new', 'in_review', 'action_taken', 'resolved', 'dismissed', 'escalated']) {
  assert.match(reportOps, new RegExp(`"${status}"`));
}
assert.match(reportOps, /local-policy-triage/);
assert.match(reportOps, /automatedDecision: false/);
assert.doesNotMatch(reportOps, /virus total|virustotal|google safe browsing|norton|mcafee/i,
  'Local triage must not falsely claim an external security-provider scan.');

assert.match(reportStatus, /updateAdminIssueReport/);
assert.match(reportAssign, /assigned_to/);
assert.match(reportScan, /"scan"/);
assert.match(reportActionCompat, /body\.action/);
assert.match(profileActionCompat, /body\.action/);

console.log('Admin profile moderation, verification and issue-report contracts passed.');
