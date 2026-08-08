import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stripe = await readFile(new URL('../functions/_shared/stripe.js', import.meta.url), 'utf8');

const centralIndex = stripe.indexOf('env.CENTRAL_PAYMENTS_API_KEY');
const customerOpsIndex = stripe.indexOf('env.CUSTOMEROPS_API_KEY');
const legacyIndex = stripe.indexOf('env.HEAD_OFFICE_PLATFORM_KEY');

assert.ok(centralIndex >= 0, 'Sousa Murray Profiles must support the dedicated CENTRAL_PAYMENTS_API_KEY Cloudflare secret.');
assert.ok(customerOpsIndex > centralIndex, 'The dedicated Central Payments key must be preferred over CUSTOMEROPS_API_KEY.');
assert.ok(legacyIndex > customerOpsIndex, 'The legacy Head Office platform key may remain only as a final compatibility fallback.');
assert.ok(stripe.includes('central_payments_not_connected'), 'Central Payments must fail closed if no server-side credential is configured.');

console.log('Sousa Murray Profiles Central Payments secret-name checks passed.');
