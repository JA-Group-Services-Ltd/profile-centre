import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge = fs.readFileSync('functions/api/customer-service/[[path]].js', 'utf8');
const assistant = fs.readFileSync('src/components/CentralCustomerServiceAssistant.tsx', 'utf8');
const layout = fs.readFileSync('src/layouts/RootLayout.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(bridge, /HEAD_OFFICE_SUPPORT_CENTRE_ENABLED/);
assert.match(bridge, /CUSTOMEROPS_API_KEY/);
assert.match(bridge, /HEAD_OFFICE_CUSTOMEROPS_URL/);
assert.match(bridge, /\/api\/v1\/platform\/support\//);
assert.match(bridge, /\/api\/v1\/platform\/support-control/);
assert.match(bridge, /sameOrigin/);
assert.match(bridge, /64_000/);
assert.match(bridge, /unavailableConfig/);
assert.match(bridge, /assistantEnabled: true/);
assert.match(bridge, /maintenanceEnabled: true/);
assert.match(bridge, /contact@jagroupservices\.co\.uk/);
assert.match(bridge, /020 3834 2790/);
assert.match(bridge, /2026-08-02-connection-recovery-1/);
assert.match(bridge, /X-JA-Customer-Service-Bridge/);
assert.match(bridge, /keyPresent: keyPresent\(env\)/);
assert.match(bridge, /supportSwitchEnabled: supportSwitchEnabled\(env\)/);
assert.match(bridge, /centralHttpStatus/);
assert.match(bridge, /CUSTOMEROPS_API_KEY_MISSING/);
assert.match(bridge, /HEAD_OFFICE_HTTP_/);
assert.match(bridge, /HEAD_OFFICE_TIMEOUT/);
assert.doesNotMatch(bridge, /Bearer\s+[A-Za-z0-9._-]{20,}/);
assert.doesNotMatch(bridge, /diagnostics[\s\S]*CUSTOMEROPS_API_KEY\s*:/, 'Diagnostics must never return the credential value.');

assert.match(assistant, /Sousa Murray Profiles Support Assistant/);
assert.match(assistant, /request_human/);
assert.match(assistant, /Head Office Customer Adviser/);
assert.match(assistant, /startsWith\('\/admin'\)/);
assert.match(assistant, /startsWith\('\/portal'\)/);
assert.match(assistant, /AppearanceConfig/);
assert.match(assistant, /launcherColour/);
assert.match(assistant, /headerBackground/);
assert.match(assistant, /panelWidth/);
assert.match(assistant, /knowledgeLimit/);
assert.match(assistant, /inputPlaceholder/);
assert.match(layout, /CentralCustomerServiceAssistant/);
assert.doesNotMatch(html, /tawk\.to/i);
assert.doesNotMatch(html, /Tawk_API/);

console.log('Sousa Murray Profiles Customer Service connection diagnostics and controls checks passed.');
