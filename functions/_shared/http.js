const BASE_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export class HttpError extends Error {
  constructor(status, message, code = "request_failed") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  });
}

export function redirect(location, status = 302, extraHeaders = {}) {
  return new Response(null, {
    status,
    headers: {
      ...BASE_HEADERS,
      "content-type": "text/plain; charset=utf-8",
      location,
      ...extraHeaders,
    },
  });
}

export async function readJson(request, maxBytes = 1_000_000) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.", "unsupported_media_type");
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, "Request body is too large.", "payload_too_large");
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new HttpError(413, "Request body is too large.", "payload_too_large");
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new HttpError(400, "Request body must contain valid JSON.", "invalid_json");
  }
}

export function methodNotAllowed(allowed, requestId) {
  return json(
    { success: false, error: "Method not allowed", code: "method_not_allowed", requestId },
    405,
    { allow: allowed.join(", ") },
  );
}

export function notFound(requestId) {
  return json(
    { success: false, error: "API route not found", code: "not_found", requestId },
    404,
  );
}

export function errorResponse(error, requestId) {
  if (error instanceof HttpError) {
    return json(
      { success: false, error: error.message, code: error.code, requestId },
      error.status,
    );
  }

  console.error(JSON.stringify({
    event: "profile_centre_api_error",
    requestId,
    error: error instanceof Error ? error.message : "Unknown error",
  }));
  return json(
    { success: false, error: "Internal server error", code: "internal_error", requestId },
    500,
  );
}

export function withRequestId(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

