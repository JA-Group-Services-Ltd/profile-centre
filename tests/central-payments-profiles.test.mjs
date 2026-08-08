import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stripe = await readFile(new URL('../functions/_shared/stripe.js', import.meta.url), 'utf8');
const middleware = await readFile(new URL('../functions/api/_middleware.js', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/STRIPE_CLOUDFLARE.md', import.meta.url), 'utf8');

describe('Sousa Murray Profiles Central Payments migration', () => {
  it('routes new billing through Head Office rather than a dedicated Stripe secret', () => {
    expect(stripe).toContain('SOUSA_MURRAY_PROFILES');
    expect(stripe).toContain('/api/v1/payments/account-info');
    expect(stripe).toContain('/api/v1/payments/checkout');
    expect(stripe).toContain('/api/v1/payments/status');
    expect(stripe).toContain('/api/v1/payments/portal');
    expect(stripe).toContain('/api/v1/payments/subscription');
    expect(stripe).toContain('CUSTOMEROPS_API_KEY');
    expect(stripe).toContain('HEAD_OFFICE_PLATFORM_KEY');
  });

  it('uses the governed Profiles standard catalogue codes', () => {
    for (const code of [
      'PROFILES_STARTER_MONTHLY',
      'PROFILES_PROFESSIONAL_MONTHLY',
      'PROFILES_ORGANISATION_MONTHLY',
      'PROFILES_ULTIMATE_ORGANISATION_MONTHLY',
    ]) expect(stripe).toContain(code);
  });

  it('reconciles Head Office subscription state before authenticated account reads', () => {
    expect(middleware).toContain('synchroniseCentralProfileBilling');
    expect(middleware).toContain('/api/auth/me');
    expect(middleware).toContain('/api/subscriptions');
  });

  it('keeps the old webhook explicitly legacy-only', () => {
    expect(stripe).toContain('legacyWebhookConfigured');
    expect(stripe).toContain('New checkouts never use this route');
    expect(docs).toContain('Legacy Profiles Stripe webhook');
  });
});
