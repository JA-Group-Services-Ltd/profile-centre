/**
 * Microsoft Graph API helper — Sousa Murray Profiles
 *
 * Uses application (client credentials) flow to call Graph on behalf of the
 * platform. This is the correct pattern for server-side profile updates in a
 * CIAM tenant where the delegated access token from the OIDC login flow does
 * not carry the Graph User.ReadWrite.All scope.
 *
 * Required app registration permissions (application, not delegated):
 *   User.ReadWrite.All  (to PATCH /users/{oid})
 *
 * Required secrets:
 *   GRAPH_TENANT_ID      — the CIAM tenant ID (3c0074dd-…)
 *   GRAPH_CLIENT_ID      — the app registration client ID (db835535-…)
 *   GRAPH_CLIENT_SECRET  — a client secret for that app registration
 *
 * SECURITY: This module is server-only. Tokens are never sent to the browser.
 */

import { getSecret } from '#airo/secrets';

// ── Token cache ───────────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let _tokenCache: TokenCache | null = null;

async function getGraphToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if it has > 60s left
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.token;
  }

  const tenantId     = getSecret('GRAPH_TENANT_ID')     as string | undefined;
  const clientId     = getSecret('GRAPH_CLIENT_ID')     as string | undefined;
  const clientSecret = getSecret('GRAPH_CLIENT_SECRET') as string | undefined;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Graph credentials not configured — set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://graph.microsoft.com/.default',
  });

  const resp = await fetch(tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Graph token request failed (${resp.status}): ${text}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };

  _tokenCache = {
    token:     data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return _tokenCache.token;
}

// ── Profile update ────────────────────────────────────────────────────────────

export interface GraphProfileUpdate {
  givenName?:   string;
  surname?:     string;
  displayName?: string;
}

/**
 * Update a customer's Entra External ID profile via Microsoft Graph.
 *
 * @param entraOid  The user's stable OID from Entra (stored in users.entra_oid)
 * @param update    Fields to update — only standard writable Graph properties
 * @throws          Error with descriptive message if the Graph call fails
 */
export async function updateEntraProfile(
  entraOid: string,
  update: GraphProfileUpdate,
): Promise<void> {
  if (!entraOid) throw new Error('entraOid is required');

  const token = await getGraphToken();

  // Build the PATCH body — only include fields that were provided
  const body: Record<string, string> = {};
  if (update.givenName   !== undefined) body.givenName   = update.givenName;
  if (update.surname     !== undefined) body.surname     = update.surname;
  if (update.displayName !== undefined) body.displayName = update.displayName;

  if (Object.keys(body).length === 0) return; // nothing to update

  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${entraOid}`, {
    method:  'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    // Invalidate token cache on auth errors so next call retries
    if (resp.status === 401 || resp.status === 403) {
      _tokenCache = null;
    }
    throw new Error(`Graph PATCH /users/${entraOid} failed (${resp.status}): ${text}`);
  }

  // 204 No Content is the success response for PATCH /users/{id}
}
