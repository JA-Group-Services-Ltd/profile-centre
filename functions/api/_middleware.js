export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);

  headers.set("cache-control", "no-store, max-age=0");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-robots-tag", "noindex, nofollow");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
