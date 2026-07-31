import fs from "node:fs";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleApiRequest } from "../functions/_shared/router.js";
import { resolveUser } from "../functions/_shared/auth.js";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  sqliteStatement() {
    const bindings = {};
    this.values.forEach((value, index) => {
      bindings[index + 1] = value;
    });
    return { statement: this.database.prepare(this.sql), bindings };
  }

  first() {
    const { statement, bindings } = this.sqliteStatement();
    return statement.get(bindings) ?? null;
  }

  all() {
    const { statement, bindings } = this.sqliteStatement();
    return { success: true, results: statement.all(bindings) };
  }

  run() {
    const { statement, bindings } = this.sqliteStatement();
    const result = statement.run(bindings);
    return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
  }
}

class D1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1Statement(this.database, sql);
  }

  batch(statements) {
    return this.database.transaction(() => statements.map((statement) => statement.run()))();
  }
}

function request(path, init = {}) {
  return new Request(`https://preview.example.test/api${path}`, init);
}

function context(database, path, init = {}) {
  return {
    env: { DB: database },
    params: { path: path.split("/").filter(Boolean) },
    request: request(path, init),
  };
}

function authenticated(method = "GET", body) {
  return {
    method,
    headers: {
      cookie: "ja_profile_studio_session=test-session",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

describe("Cloudflare API router", () => {
  let sqlite;
  let d1;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(fs.readFileSync("migrations/0002_full_d1_schema.sql", "utf8"));
    sqlite.exec(`
      INSERT INTO plans (id, name, slug, max_links, is_active, is_public)
      VALUES (1, 'Free', 'free', 5, 1, 1);
      INSERT INTO users (id, email, name, role, plan_id, entra_oid)
      VALUES (1, 'customer@example.test', 'Test Customer', 'user', 1, 'test-oid');
      INSERT INTO users (id, email, name, role, plan_id, entra_oid)
      VALUES (2, 'admin@example.test', 'Test Admin', 'admin', 1, 'test-admin-oid');
      INSERT INTO sessions (sid, data, expires_at)
      VALUES ('test-session', '{"userId":1}', 4102444800000);
      INSERT INTO sessions (sid, data, expires_at)
      VALUES ('non-admin-session', '{"adminUserId":1}', 4102444800000);
      INSERT INTO sessions (sid, data, expires_at)
      VALUES ('admin-session', '{"adminUserId":2,"flow":"admin"}', 4102444800000);
      INSERT INTO profiles (id, user_id, username, display_name, profile_type, is_published)
      VALUES (10, 1, 'test-profile', 'Test Profile', 'personal', 0);
      INSERT INTO profile_business_details (id, business_name) VALUES (10, 'Example Ltd');
      INSERT INTO profile_public_content (id, headline) VALUES (10, 'Original headline');
      INSERT INTO profile_configuration (id, pin_hash, public_pin_hash, show_email)
      VALUES (10, 'private-pin', 'private-public-pin', 1);
      INSERT INTO admin_settings (key, value) VALUES ('business_cards_enabled', '1');
    `);
    d1 = new D1Database(sqlite);
  });

  afterEach(() => sqlite.close());

  it("returns JSON 404 for unknown API paths", async () => {
    const response = await handleApiRequest(context(d1, "/test-not-found"));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ success: false, code: "not_found" });
  });

  it("normalizes root catch-all params before API dispatch", async () => {
    const rootContext = context(d1, "/plans");
    rootContext.params.path = ["api", "plans"];
    const response = await handleApiRequest(rootContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("returns JSON 401 for a protected route without a session", async () => {
    const response = await handleApiRequest(context(d1, "/profiles/me"));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("joins normalized profile tables without exposing PIN hashes", async () => {
    const response = await handleApiRequest(context(d1, "/profiles/me", authenticated()));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data[0]).toMatchObject({
      id: 10,
      business_name: "Example Ltd",
      headline: "Original headline",
      show_email: 1,
    });
    expect(payload.data[0]).not.toHaveProperty("pin_hash");
    expect(payload.data[0]).not.toHaveProperty("public_pin_hash");
  });

  it("updates fields in their normalized profile tables", async () => {
    const response = await handleApiRequest(context(d1, "/profiles/10", authenticated("PATCH", {
      display_name: "Updated Profile",
      headline: "Updated headline",
      show_email: false,
    })));
    expect(response.status).toBe(200);
    expect(sqlite.prepare("SELECT display_name FROM profiles WHERE id = 10").get().display_name)
      .toBe("Updated Profile");
    expect(sqlite.prepare("SELECT headline FROM profile_public_content WHERE id = 10").get().headline)
      .toBe("Updated headline");
    expect(sqlite.prepare("SELECT show_email FROM profile_configuration WHERE id = 10").get().show_email)
      .toBe(0);
  });

  it("treats SQL injection text as data", async () => {
    const injection = `Robert'); DROP TABLE profiles;--`;
    const response = await handleApiRequest(context(d1, "/profiles/10", authenticated("PATCH", {
      display_name: injection,
    })));
    expect(response.status).toBe(200);
    expect(sqlite.prepare("SELECT display_name FROM profiles WHERE id = 10").get().display_name)
      .toBe(injection);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM profiles").get().count).toBe(1);
  });

  it("requires an admin role for admin routes", async () => {
    const response = await handleApiRequest(context(d1, "/admin/plans", {
      method: "GET",
      headers: { cookie: "ja_profile_studio_session=non-admin-session" },
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("returns the authenticated admin session used by the portal guard", async () => {
    const response = await handleApiRequest(context(d1, "/auth/admin/me", {
      method: "GET",
      headers: { cookie: "ja_profile_studio_session=admin-session" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        user: {
          id: 2,
          email: "admin@example.test",
          role: "admin",
        },
      },
    });
  });

  it("sets an admin PIN as a hash and verifies the PIN session", async () => {
    const setResponse = await handleApiRequest(context(d1, "/admin/pin/set", {
      method: "POST",
      headers: {
        cookie: "ja_profile_studio_session=admin-session",
        "content-type": "application/json",
      },
      body: JSON.stringify({ pin: "4826" }),
    }));
    expect(setResponse.status).toBe(200);
    expect(await setResponse.json()).toMatchObject({ success: true });

    const pinRow = sqlite.prepare(
      "SELECT pin_hash FROM admin_pins WHERE admin_id = 2",
    ).get();
    expect(pinRow.pin_hash).not.toBe("4826");
    expect(pinRow.pin_hash).toMatch(/^\$2[aby]\$/);

    const statusResponse = await handleApiRequest(context(d1, "/admin/pin/status", {
      method: "GET",
      headers: { cookie: "ja_profile_studio_session=admin-session" },
    }));
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toMatchObject({
      success: true,
      hasPin: true,
      pinVerified: true,
      locked: false,
    });
  });

  it("keeps customer and workforce object IDs separate for an administrator", async () => {
    const customer = await resolveUser(d1, {
      oid: "customer-admin-oid",
      email: "admin@example.test",
      name: "Test Admin",
    }, false, "Administrator");
    expect(customer.id).toBe(2);

    const workforce = await resolveUser(d1, {
      oid: "workforce-admin-oid",
      email: "admin@example.test",
      name: "Test Admin",
      roles: ["Administrator"],
    }, true, "Administrator");
    expect(workforce.id).toBe(2);

    expect(sqlite.prepare(
      "SELECT entra_oid, admin_entra_oid FROM users WHERE id = 2",
    ).get()).toEqual({
      entra_oid: "customer-admin-oid",
      admin_entra_oid: "workforce-admin-oid",
    });
  });

  it("writes and joins normalized business-card order tables", async () => {
    const response = await handleApiRequest(context(d1, "/business-cards", authenticated("POST", {
      profile_id: 10,
      request_type: "builder",
      quantity: 100,
      name_on_card: "Test Customer",
      tagline_on_card: "A safe test",
      brand_colors: ["#000000", "#ffffff"],
    })));
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.order).toMatchObject({
      profile_id: 10,
      quantity: 100,
      name_on_card: "Test Customer",
      tagline_on_card: "A safe test",
    });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM business_card_order_design").get().count).toBe(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM business_card_order_financials").get().count).toBe(1);
    expect(payload.order).not.toHaveProperty("provider_cost");
  });
});
