const DEFAULT_HEAD_OFFICE_URL = 'https://customerops.jagroupservices.co.uk';
const BRIDGE_VERSION = '2026-08-02-connection-recovery-1';
const ALLOWED_GET = [/^config$/, /^knowledge$/, /^conversations\/[^/]+\/messages$/];
const ALLOWED_WRITE = [/^conversations$/, /^conversations\/[^/]+\/messages$/, /^conversations\/[^/]+\/events$/, /^conversations\/[^/]+\/escalate$/];

function responseHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'X-JA-Customer-Service-Bridge': BRIDGE_VERSION,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders() });
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function supportSwitchEnabled(env) {
  return String(env.HEAD_OFFICE_SUPPORT_CENTRE_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

function keyPresent(env) {
  return clean(env.CUSTOMEROPS_API_KEY, 500).length > 20;
}

function enabled(env) {
  return supportSwitchEnabled(env) && keyPresent(env);
}

function headOfficeOrigin(env) {
  const configured = clean(env.HEAD_OFFICE_CUSTOMEROPS_URL || env.CUSTOMEROPS_BASE_URL || DEFAULT_HEAD_OFFICE_URL, 500).replace(/\/$/, '');
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw Object.assign(new Error('The Head Office Customer Service URL must use HTTPS.'), { code: 'HEAD_OFFICE_URL_INVALID' });
  }
  return url.origin;
}

function safeHeadOfficeOrigin(env) {
  try { return headOfficeOrigin(env); }
  catch { return DEFAULT_HEAD_OFFICE_URL; }
}

function diagnostics(env, overrides = {}) {
  return {
    bridgeVersion: BRIDGE_VERSION,
    supportSwitchEnabled: supportSwitchEnabled(env),
    keyPresent: keyPresent(env),
    headOfficeOrigin: safeHeadOfficeOrigin(env),
    centralStatus: 'not_attempted',
    centralHttpStatus: null,
    errorCode: null,
    ...overrides,
  };
}

function unavailableConfig() {
  return {
    assistantEnabled: true,
    aiEnabled: false,
    humanTakeoverEnabled: false,
    anonymousEnabled: true,
    maintenanceEnabled: true,
    assistantName: 'Profile Centre Customer Service',
    greeting: 'Profile Centre support is available through JA Group Services Head Office.',
    maintenanceMessage: 'Live Head Office chat is temporarily unavailable on Profile Centre. Please email contact@jagroupservices.co.uk or call 020 3834 2790.',
    appearance: {},
    contactOptions: { email: 'contact@jagroupservices.co.uk', phone: '020 3834 2790' },
  };
}

function configFallback(env, errorCode, centralHttpStatus = null, centralStatus = 'unavailable') {
  const config = unavailableConfig();
  return json({
    success: true,
    connected: false,
    centralEnabled: enabled(env),
    config,
    branch: config,
    diagnostics: diagnostics(env, { centralStatus, centralHttpStatus, errorCode }),
  });
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (origin && origin !== new URL(request.url).origin) return false;
  return !fetchSite || ['same-origin', 'same-site', 'none'].includes(fetchSite);
}

function routePath(context) {
  const value = context.params?.path;
  return clean(Array.isArray(value) ? value.join('/') : value, 600).replace(/^\/+|\/+$/g, '');
}

function routeAllowed(method, path) {
  const rules = ['GET', 'HEAD'].includes(method) ? ALLOWED_GET : ALLOWED_WRITE;
  return rules.some(rule => rule.test(path));
}

async function requestBody(request, path) {
  if (['GET', 'HEAD'].includes(request.method)) return undefined;
  const text = await request.text();
  if (text.length > 64_000) throw Object.assign(new Error('The support request is too large.'), { status: 413 });
  const payload = text ? JSON.parse(text) : {};
  if (/^conversations\/[^/]+\/messages$/.test(path)) {
    payload.senderType = 'customer';
    delete payload.senderId;
  }
  return JSON.stringify(payload);
}

function centralPath(path, search) {
  if (path === 'config') return `/api/v1/platform/support-control${search || ''}`;
  return `/api/v1/platform/support/${path}${search || ''}`;
}

function activationError(env) {
  if (!supportSwitchEnabled(env)) return 'SUPPORT_SWITCH_DISABLED';
  if (!keyPresent(env)) return 'CUSTOMEROPS_API_KEY_MISSING';
  return null;
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (!['GET', 'HEAD', 'POST'].includes(method)) return json({ success: false, error: 'Method not allowed.' }, 405);
  if (!['GET', 'HEAD'].includes(method) && !sameOrigin(context.request)) return json({ success: false, error: 'Request origin was rejected.' }, 403);

  const path = routePath(context);
  if (!routeAllowed(method, path)) return json({ success: false, error: 'Support route not found.' }, 404);

  if (!enabled(context.env)) {
    const errorCode = activationError(context.env);
    if (method === 'GET' && path === 'config') return configFallback(context.env, errorCode, null, 'not_attempted');
    if (method === 'GET' && path === 'knowledge') return json({ success: true, connected: false, articles: [], diagnostics: diagnostics(context.env, { errorCode }) });
    return json({ success: false, error: 'Live Head Office chat is temporarily unavailable. Please email contact@jagroupservices.co.uk or call 020 3834 2790.', code: errorCode }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = await requestBody(context.request, path);
    const incomingUrl = new URL(context.request.url);
    const response = await fetch(`${headOfficeOrigin(context.env)}${centralPath(path, incomingUrl.search)}`, {
      method,
      headers: {
        Authorization: `Bearer ${clean(context.env.CUSTOMEROPS_API_KEY, 500)}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'User-Agent': `Profile-Centre-Central-Support/${BRIDGE_VERSION}`,
      },
      body,
      signal: controller.signal,
    });
    const payloadText = await response.text();

    if (method === 'GET' && path === 'config') {
      if (!response.ok) return configFallback(context.env, `HEAD_OFFICE_HTTP_${response.status}`, response.status, 'rejected');
      let payload = {};
      try { payload = payloadText ? JSON.parse(payloadText) : {}; } catch {}
      return json({
        ...payload,
        success: true,
        connected: payload.connected === true,
        diagnostics: diagnostics(context.env, {
          centralStatus: payload.connected === true ? 'connected' : 'responded',
          centralHttpStatus: response.status,
          errorCode: payload.connected === true ? null : 'HEAD_OFFICE_NOT_CONFIRMED',
        }),
      });
    }

    return new Response(payloadText || '{}', { status: response.status, headers: responseHeaders() });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const errorCode = timedOut ? 'HEAD_OFFICE_TIMEOUT' : clean(error?.code || 'HEAD_OFFICE_UNREACHABLE', 120);
    if (method === 'GET' && path === 'config') return configFallback(context.env, errorCode, timedOut ? 504 : null, timedOut ? 'timeout' : 'unavailable');
    return json({ success: false, code: errorCode, error: timedOut ? 'Head Office Customer Service did not respond within the secure timeout.' : 'Head Office Customer Service is temporarily unavailable.' }, timedOut ? 504 : Number(error?.status || 502));
  } finally {
    clearTimeout(timeout);
  }
}
