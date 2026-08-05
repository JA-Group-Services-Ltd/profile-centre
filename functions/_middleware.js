import { requestHeadOffice } from './_shared/head-office.js';

const SESSION_COOKIE = 'ja_profile_studio_session';
const STATIC_FILE = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|txt|xml|webmanifest)$/i;

function parseCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return part.slice(separator + 1).trim(); }
  }
  return '';
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

function deviceDetails(request) {
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 500);
  const browser = /Edg\//i.test(userAgent) ? 'Microsoft Edge'
    : /Firefox\//i.test(userAgent) ? 'Mozilla Firefox'
    : /Chrome|CriOS/i.test(userAgent) ? 'Google Chrome'
    : /Safari\//i.test(userAgent) ? 'Safari' : 'Web browser';
  const operatingSystem = /Windows/i.test(userAgent) ? 'Windows'
    : /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS or iPadOS'
    : /Android/i.test(userAgent) ? 'Android'
    : /Mac OS X/i.test(userAgent) ? 'macOS'
    : /Linux/i.test(userAgent) ? 'Linux' : 'Unknown operating system';
  const category = /iPad|Tablet/i.test(userAgent) ? 'tablet'
    : /Mobi|iPhone|Android/i.test(userAgent) ? 'mobile' : 'computer';
  const cf = request.cf || {};
  return {
    device: {
      category,
      name: `${browser} on ${operatingSystem}`,
      browser,
      operatingSystem,
      userAgentSummary: `${browser} · ${operatingSystem} · ${category}`,
    },
    location: {
      countryCode: String(cf.country || '').slice(0, 8),
      countryName: String(cf.country || '').slice(0, 100),
      region: String(cf.region || '').slice(0, 120),
      city: String(cf.city || '').slice(0, 120),
    },
  };
}

function isApi(pathname) {
  return pathname.startsWith('/api/');
}

function isLogout(pathname) {
  return pathname === '/logout'
    || pathname.endsWith('/logout')
    || pathname.includes('/auth/logout');
}

function revokedResponse(request) {
  const url = new URL(request.url);
  if (isApi(url.pathname)) {
    return Response.json({
      success: false,
      error: 'This Sousa Murray Profiles session has been revoked. Sign in again to continue.',
      code: 'connected_session_revoked',
    }, {
      status: 401,
      headers: {
        'cache-control': 'no-store',
        'set-cookie': clearSessionCookie(),
      },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: '/login?error=session_revoked',
      'cache-control': 'no-store',
      'set-cookie': clearSessionCookie(),
    },
  });
}

async function loadCustomerSession(request, env) {
  const sid = parseCookie(request, SESSION_COOKIE);
  if (!sid || !env.DB) return null;
  const row = await env.DB.prepare(`SELECT sid,data,expires_at FROM sessions
    WHERE sid=?1 AND expires_at>?2 LIMIT 1`).bind(sid, Date.now()).first();
  if (!row?.data) return null;
  let data;
  try { data = JSON.parse(row.data); } catch { return null; }
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId < 1 || data.flow !== 'customer') return null;
  const user = await env.DB.prepare(`SELECT id,name,email,customer_number,head_office_customer_id,entra_oid
    FROM users WHERE id=?1 LIMIT 1`).bind(userId).first();
  if (!user) return null;

  if (!data.sessionReference) {
    data.sessionReference = `pfc-${crypto.randomUUID()}`;
    data.sessionStartedAt = new Date().toISOString();
    await env.DB.prepare('UPDATE sessions SET data=?1 WHERE sid=?2')
      .bind(JSON.stringify(data), sid).run();
  }

  return { sid, row, data, user };
}

async function registerSession(request, env, current) {
  const startedAt = current.data.sessionStartedAt || new Date().toISOString();
  return requestHeadOffice(env, '/api/platform/sessions', {
    method: 'POST',
    body: JSON.stringify({
      customer: {
        centralCustomerId: current.user.head_office_customer_id || undefined,
        customerNumber: current.user.customer_number || undefined,
        platformCustomerId: String(current.user.id),
      },
      session: {
        externalSessionId: current.data.sessionReference,
        status: 'active',
        startedAt,
        lastSeenAt: new Date().toISOString(),
        expiresAt: new Date(Number(current.row.expires_at)).toISOString(),
        ...deviceDetails(request),
        metadata: {
          service: 'Sousa Murray Profiles',
          source: 'profile_centre_customer_session',
        },
      },
    }),
  });
}

async function centralDecision(request, env, current) {
  try {
    return await requestHeadOffice(
      env,
      `/api/platform/sessions/${encodeURIComponent(current.data.sessionReference)}`,
    );
  } catch (error) {
    if (Number(error?.headOfficeStatus) !== 404) throw error;
    await registerSession(request, env, current);
    return { found: true, active: true, status: 'active', revoke: false };
  }
}

async function closeCentralSession(env, current) {
  try {
    await requestHeadOffice(env, `/api/platform/sessions/${encodeURIComponent(current.data.sessionReference)}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Customer signed out of Sousa Murray Profiles.' }),
    });
  } catch (error) {
    if (Number(error?.headOfficeStatus) !== 404) {
      console.error('profile-centre.connected-session.close.failed', error);
    }
  }
}

export const onRequest = async context => {
  const pathname = new URL(context.request.url).pathname;
  if (STATIC_FILE.test(pathname) || pathname.startsWith('/admin')) return context.next();

  const current = await loadCustomerSession(context.request, context.env);
  if (!current) return context.next();

  if (isLogout(pathname)) {
    await closeCentralSession(context.env, current);
    return context.next();
  }

  try {
    const decision = await centralDecision(context.request, context.env, current);
    if (decision?.revoke || decision?.active === false || decision?.status === 'revocation_required') {
      await context.env.DB.prepare('DELETE FROM sessions WHERE sid=?1').bind(current.sid).run();
      return revokedResponse(context.request);
    }
  } catch (error) {
    // The existing Head Office access-decision gate remains authoritative and
    // fail-closed. This device check alone tolerates a brief connector outage so
    // static navigation does not destroy an otherwise valid local session.
    console.error('profile-centre.connected-session.check.failed', error);
  }

  return context.next();
};
