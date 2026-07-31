const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
};

const MIGRATION_URL =
  "https://raw.githubusercontent.com/alfiemurray03/profile-centre/ab916ed77ca8171338d65fc4d7c3ec69a0445096/migrations/0001_cloudflare_foundation.sql";

const APPLICATION_TABLES_SQL = `
  SELECT name
  FROM sqlite_schema
  WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_cf_%'
    AND name NOT LIKE 'd1_%'
  ORDER BY name
`;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  });
}

async function listApplicationTables(database) {
  const result = await database.prepare(APPLICATION_TABLES_SQL).all();
  return (result.results ?? []).map((row) => String(row.name));
}

async function getSchemaVersion(database) {
  try {
    const record = await database
      .prepare("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1")
      .bind("schema_version")
      .first();

    return record?.value ? String(record.value) : null;
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();

  if (!context.env.DB) {
    return json(
      {
        status: "not_configured",
        message: "The D1 binding DB is not available to this Pages deployment.",
        requestId,
      },
      503,
      { "x-request-id": requestId },
    );
  }

  try {
    const tables = await listApplicationTables(context.env.DB);
    const schemaVersion = await getSchemaVersion(context.env.DB);

    return json(
      {
        status: schemaVersion ? "already_configured" : tables.length === 0 ? "ready" : "blocked",
        schemaVersion,
        tables,
        message: schemaVersion
          ? "The Profile Centre D1 schema is already installed."
          : tables.length === 0
            ? "The database is empty and ready for the one-time setup request."
            : "The database contains unexpected tables, so automatic setup is blocked.",
        requestId,
      },
      tables.length === 0 || schemaVersion ? 200 : 409,
      { "x-request-id": requestId },
    );
  } catch (error) {
    return json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unable to inspect the D1 database.",
        requestId,
      },
      500,
      { "x-request-id": requestId },
    );
  }
}

export async function onRequestPost(context) {
  const requestId = crypto.randomUUID();

  if (!context.env.DB) {
    return json(
      {
        status: "not_configured",
        message: "The D1 binding DB is not available to this Pages deployment.",
        requestId,
      },
      503,
      { "x-request-id": requestId },
    );
  }

  try {
    const existingTables = await listApplicationTables(context.env.DB);
    const existingSchemaVersion = await getSchemaVersion(context.env.DB);

    if (existingSchemaVersion) {
      return json(
        {
          status: "already_configured",
          schemaVersion: existingSchemaVersion,
          tables: existingTables,
          requestId,
        },
        200,
        { "x-request-id": requestId },
      );
    }

    if (existingTables.length > 0) {
      return json(
        {
          status: "blocked",
          message: "Automatic setup refused because the database is not empty.",
          tables: existingTables,
          requestId,
        },
        409,
        { "x-request-id": requestId },
      );
    }

    const migrationResponse = await fetch(MIGRATION_URL, {
      headers: { accept: "text/plain" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });

    if (!migrationResponse.ok) {
      throw new Error(`Unable to retrieve the pinned migration (${migrationResponse.status}).`);
    }

    const migrationSql = await migrationResponse.text();

    if (
      !migrationSql.includes("CREATE TABLE IF NOT EXISTS app_settings") ||
      !migrationSql.includes("CREATE TABLE IF NOT EXISTS users") ||
      !migrationSql.includes("CREATE TABLE IF NOT EXISTS profiles") ||
      !migrationSql.includes("CREATE TABLE IF NOT EXISTS subscriptions")
    ) {
      throw new Error("The pinned migration failed its integrity checks.");
    }

    const execution = await context.env.DB.exec(migrationSql);
    const schemaVersion = await getSchemaVersion(context.env.DB);
    const tables = await listApplicationTables(context.env.DB);

    if (schemaVersion !== "1") {
      throw new Error("The migration executed but schema version 1 could not be verified.");
    }

    console.log(JSON.stringify({
      event: "profile_centre_d1_schema_installed",
      requestId,
      schemaVersion,
      tableCount: tables.length,
      statementCount: execution.count,
      durationMs: execution.duration,
    }));

    return json(
      {
        status: "created",
        schemaVersion,
        tables,
        execution: {
          statementCount: execution.count,
          durationMs: execution.duration,
        },
        requestId,
      },
      201,
      { "x-request-id": requestId },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "profile_centre_d1_schema_install_failed",
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    }));

    return json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Database setup failed.",
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
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}
