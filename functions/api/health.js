const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
};

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  });
}

async function checkDatabase(database) {
  if (!database) {
    return {
      status: "not_configured",
      schemaVersion: null,
    };
  }

  const record = await database
    .prepare("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1")
    .bind("schema_version")
    .first();

  return {
    status: record?.value ? "ok" : "migration_required",
    schemaVersion: record?.value ?? null,
  };
}

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const database = await checkDatabase(context.env.DB);
    const healthy = database.status === "ok";
    const status = healthy ? 200 : 503;

    const payload = {
      status: healthy ? "ok" : "degraded",
      service: "profile-centre",
      environment: context.env.ENVIRONMENT ?? "unknown",
      checks: {
        database,
      },
      requestId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };

    console.log(JSON.stringify({
      event: "health_check",
      status: payload.status,
      requestId,
      durationMs: payload.durationMs,
    }));

    return json(payload, status, { "x-request-id": requestId });
  } catch (error) {
    console.error(JSON.stringify({
      event: "health_check_failed",
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    }));

    return json(
      {
        status: "degraded",
        service: "profile-centre",
        checks: {
          database: {
            status: "error",
            schemaVersion: null,
          },
        },
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
      503,
      { "x-request-id": requestId },
    );
  }
}

export function onRequestHead() {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}
