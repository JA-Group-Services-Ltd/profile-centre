const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "access-control-allow-origin": "*",
};

const IMPORT_ID = "profile-centre-airo-20260731T011911Z";
const EXPECTED_SHA256 = "bac25a94725e041e391204f19eb988ddddecad624abee743d935443526bb1d73";
const MAX_BODY_BYTES = 1_000_000;
const BATCH_SIZE = 25;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  });
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(buffer) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)));
}

async function getSetting(database, key) {
  try {
    const record = await database
      .prepare("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1")
      .bind(key)
      .first();
    return record?.value == null ? null : String(record.value);
  } catch {
    return null;
  }
}

async function runStatements(database, statements, phase) {
  let executed = 0;
  let durationMs = 0;

  for (let offset = 0; offset < statements.length; offset += BATCH_SIZE) {
    const chunk = statements.slice(offset, offset + BATCH_SIZE);
    try {
      const results = await database.batch(
        chunk.map((statement) => database.prepare(statement)),
      );
      executed += chunk.length;
      durationMs += results.reduce(
        (total, result) => total + Number(result?.meta?.duration ?? 0),
        0,
      );
    } catch (error) {
      throw new Error(
        `${phase} failed near statement ${offset + 1}: ${error instanceof Error ? error.message : "Unknown D1 error"}`,
      );
    }
  }

  return { executed, durationMs };
}

async function verifyCounts(database, expectedCounts) {
  const entries = Object.entries(expectedCounts);
  const mismatches = [];
  const verified = {};

  for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
    const chunk = entries.slice(offset, offset + BATCH_SIZE);
    const results = await database.batch(
      chunk.map(([table]) =>
        database.prepare(`SELECT COUNT(*) AS count FROM "${table.replaceAll('"', '""')}"`),
      ),
    );

    for (let index = 0; index < chunk.length; index += 1) {
      const [table, expected] = chunk[index];
      const actual = Number(results[index]?.results?.[0]?.count ?? -1);
      verified[table] = actual;
      if (actual !== Number(expected)) {
        mismatches.push({ table, expected: Number(expected), actual });
      }
    }
  }

  return { verified, mismatches };
}

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  if (!context.env.DB) {
    return json(
      {
        status: "not_configured",
        message: "The D1 binding DB is not available.",
        requestId,
      },
      503,
      { "x-request-id": requestId },
    );
  }

  const completedImportId = await getSetting(context.env.DB, "production_import_id");
  const schemaVersion = await getSetting(context.env.DB, "schema_version");

  return json(
    {
      status: completedImportId === IMPORT_ID ? "complete" : "ready",
      importId: IMPORT_ID,
      schemaVersion,
      payloadSha256: EXPECTED_SHA256,
      importerVersion: "2",
      normalizedTables: ["profiles", "business_card_orders"],
      requestId,
    },
    200,
    { "x-request-id": requestId },
  );
}

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (!context.env.DB) {
    return json(
      {
        status: "not_configured",
        message: "The D1 binding DB is not available.",
        requestId,
      },
      503,
      { "x-request-id": requestId },
    );
  }

  try {
    const existingImportId = await getSetting(context.env.DB, "production_import_id");
    if (existingImportId === IMPORT_ID) {
      return json(
        {
          status: "already_complete",
          importId: IMPORT_ID,
          schemaVersion: await getSetting(context.env.DB, "schema_version"),
          requestId,
        },
        200,
        { "x-request-id": requestId },
      );
    }

    const body = await context.request.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) {
      return json(
        {
          status: "rejected",
          message: "The import payload is missing or exceeds the permitted size.",
          requestId,
        },
        413,
        { "x-request-id": requestId },
      );
    }

    const digest = await sha256(body);
    if (digest !== EXPECTED_SHA256) {
      return json(
        {
          status: "rejected",
          message: "The import payload did not match the approved production export.",
          requestId,
        },
        403,
        { "x-request-id": requestId },
      );
    }

    const payload = JSON.parse(new TextDecoder().decode(body));
    if (
      payload?.formatVersion !== 2 ||
      payload?.importId !== IMPORT_ID ||
      payload?.sourceEnvironment !== "production" ||
      !Array.isArray(payload?.dropStatements) ||
      !Array.isArray(payload?.schemaStatements) ||
      !Array.isArray(payload?.dataStatements) ||
      !Array.isArray(payload?.indexStatements) ||
      !Array.isArray(payload?.metadataStatements) ||
      typeof payload?.expectedCounts !== "object" ||
      payload?.expectedCounts === null
    ) {
      return json(
        {
          status: "rejected",
          message: "The approved payload structure was invalid.",
          requestId,
        },
        400,
        { "x-request-id": requestId },
      );
    }

    const phaseResults = {};
    phaseResults.drop = await runStatements(context.env.DB, payload.dropStatements, "Drop phase");
    phaseResults.schema = await runStatements(context.env.DB, payload.schemaStatements, "Schema phase");
    phaseResults.data = await runStatements(context.env.DB, payload.dataStatements, "Data phase");
    phaseResults.indexes = await runStatements(context.env.DB, payload.indexStatements, "Index phase");
    phaseResults.metadata = await runStatements(context.env.DB, payload.metadataStatements, "Metadata phase");

    const verification = await verifyCounts(context.env.DB, payload.expectedCounts);
    if (verification.mismatches.length > 0) {
      throw new Error(
        `Record-count verification failed for ${verification.mismatches.length} table(s).`,
      );
    }

    const schemaVersion = await getSetting(context.env.DB, "schema_version");
    const completedImportId = await getSetting(context.env.DB, "production_import_id");
    if (schemaVersion !== "3" || completedImportId !== IMPORT_ID) {
      throw new Error("The import completed but its migration markers could not be verified.");
    }

    const importantCounts = Object.fromEntries(
      [
        "users",
        "profiles",
        "subscriptions",
        "plans",
        "audit_log",
        "themes",
        "platform_features",
        "feature_plan_rules",
      ].map((table) => [table, verification.verified[table] ?? 0]),
    );

    console.log(JSON.stringify({
      event: "profile_centre_production_data_imported",
      requestId,
      importId: IMPORT_ID,
      schemaVersion,
      importantCounts,
      durationMs: Date.now() - startedAt,
    }));

    return json(
      {
        status: "complete",
        importId: IMPORT_ID,
        schemaVersion,
        sourceExportedAt: payload.sourceExportedAt,
        sourceTableCount: payload.sourceTableCount,
        migratedRowCount: Object.values(payload.expectedCounts).reduce(
          (total, count) => total + Number(count),
          0,
        ),
        importantCounts,
        securityActions: payload.securityActions,
        phases: phaseResults,
        durationMs: Date.now() - startedAt,
        requestId,
      },
      201,
      { "x-request-id": requestId },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "profile_centre_production_data_import_failed",
      requestId,
      importId: IMPORT_ID,
      error: error instanceof Error ? error.message : "Unknown error",
    }));

    return json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "The D1 import failed.",
        importId: IMPORT_ID,
        requestId,
      },
      500,
      { "x-request-id": requestId },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
    },
  });
}
