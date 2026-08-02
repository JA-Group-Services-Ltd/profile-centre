const DEFAULT_HEAD_OFFICE_URL = 'https://customerops.jagroupservices.co.uk';
const ALLOWED_GET = [
  /^config$/,
  /^knowledge$/,
  /^conversations\/[^/]+\/messages$/,
];
const ALLOWED_WRITE = [
  /^conversations$/,
  /^conversations\/[^/]+\/messages$/,
  /^conversations\/[^/]+\/events$/,
  /^conversations\/[^/]+\/escalate$/,
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function enabled(env) {
  const switchValue = String(env.HEAD_OFFICE_SUPPORT_CENTRE_ENABLED ?? 'true').trim().toLowerCase();
  return switchValue !== 'false' && clean(env.CUSTOMEROPS_API_KEY, 500).length > 20;
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

function headOfficeOrigin(env) {
  const configured = clean(env.CUSTOMEROPS_BASE_URL || DEFAULT_HEAD_OFFICE_URL, 500).replace(/\/$/, '');
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('The Head Office Customer Service URL must use HTTPS.');
  }
  return url.origin;
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

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (!['GET', 'HEAD', 'POST'].includes(method)) return json({ success: false, error: 'Method not allowed.' }, 405);
  if (!['GET', 'HEAD'].includes(method) && !sameOrigin(context.request)) {
    return json({ success: false, error: 'Request origin was rejected.' }, 403);
  }

  const path = routePath(context);
  if (!routeAllowed(method, path)) return json({ success: false, error: 'Support route not found.' }, 404);

  if (!enabled(context.env)) {
    if (method === 'GET' && path === 'config') {
      const config = unavailableConfig();
      return json({ success: true, connected: false, config, branch: config });
    }
    if (method === 'GET' && path === 'knowledge') {
      return json({ success: true, connected: false, articles: [] });
    }
    return json({ success: false, error: 'Live Head Office chat is temporarily unavailable. Please email contact@jagroupservices.co.uk or call 020 3834 2790.' }, 503);
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
        'User-Agent': 'Profile-Centre-Central-Support/2.0',
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.text();
    return new Response(payload || '{}', {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      },
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const status = timedOut ? 504 : Number(error?.status || 502);
    return json({
      success: false,
      error: timedOut
        ? 'Head Office Customer Service did not respond within the secure timeout.'
        : error instanceof Error ? error.message : 'Head Office Customer Service is temporarily unavailable.',
    }, status);
  } finally {
    clearTimeout(timeout);
  }
}
