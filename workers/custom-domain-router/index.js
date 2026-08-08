const DEFAULT_ORIGIN = "https://sousamurrayprofiles.jagroupservices.co.uk";

function profilesOrigin(env) {
  const value = String(env.PROFILES_ORIGIN || DEFAULT_ORIGIN).trim().replace(/\/$/, "");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("PROFILES_ORIGIN must use HTTPS.");
  return url;
}

function isInternalHostname(hostname) {
  const value = String(hostname || "").toLowerCase();
  return value === "jagroupservices.co.uk" || value.endsWith(".jagroupservices.co.uk") || value.endsWith(".pages.dev");
}

function copyRequestHeaders(request, customHostname) {
  const headers = new Headers(request.headers);
  // The canonical Pages origin must receive its own Host from fetch(). Preserve the
  // customer's hostname separately for diagnostics without trusting it for routing.
  headers.delete("host");
  headers.set("x-sousa-murray-custom-hostname", customHostname);
  return headers;
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const hostname = incoming.hostname.toLowerCase();

    // This Worker is intentionally attached only to exact customer hostname routes.
    // Fail closed if it is ever accidentally routed over a JA Group Services hostname.
    if (isInternalHostname(hostname)) {
      return new Response("Custom domain router is not available on this hostname.", { status: 421 });
    }

    const origin = profilesOrigin(env);
    const target = new URL(`${incoming.pathname}${incoming.search}`, origin);
    const headers = copyRequestHeaders(request, hostname);

    const upstream = await fetch(new Request(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? undefined : request.body,
      redirect: "manual",
    }));

    const responseHeaders = new Headers(upstream.headers);
    const location = responseHeaders.get("location");
    if (location) {
      try {
        const redirect = new URL(location, origin);
        if (redirect.origin === origin.origin) {
          redirect.protocol = incoming.protocol;
          redirect.host = incoming.host;
          responseHeaders.set("location", redirect.toString());
        }
      } catch {
        // Relative Location headers are already safe to pass through.
      }
    }

    responseHeaders.set("x-sousa-murray-custom-domain", "1");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
