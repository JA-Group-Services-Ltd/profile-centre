import fs from "node:fs";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { handleAdminPlanApiRequest } from "../functions/_shared/admin-plan-routes.js";

class D1Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.database, this.sql, values); }
  sqliteStatement() {
    const bindings = {};
    this.values.forEach((value, index) => { bindings[index + 1] = value; });
    return { statement: this.database.prepare(this.sql), bindings };
  }
  first() { const { statement, bindings } = this.sqliteStatement(); return statement.get(bindings) ?? null; }
  all() { const { statement, bindings } = this.sqliteStatement(); return { success: true, results: statement.all(bindings) }; }
  run() {
    const { statement, bindings } = this.sqliteStatement();
    const result = statement.run(bindings);
    return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
  }
}

class D1Database {
  constructor(database) { this.database = database; }
  prepare(sql) { return new D1Statement(this.database, sql); }
  batch(statements) { return this.database.transaction(() => statements.map(statement => statement.run()))(); }
}

function context(database, path, { method = "GET", body, token, action } = {}) {
  const headers = new Headers({ cookie: "ja_profile_studio_session=admin-session" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("x-admin-pin-token", token);
  if (action) headers.set("x-admin-pin-action", action);
  return {
    env: { DB: database },
    request: new Request(`https://sousamurrayprofiles.jagroupservices.co.uk${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  };
}

async function jsonResponse(response) {
  expect(response).not.toBeNull();
  return { response, body: await response.json() };
}

describe("Admin Centre User & CRM plan routes", () => {
  let sqlite;
  let d1;

  beforeEach(async () => {
    sqlite = new Database(":memory:");
    sqlite.exec(fs.readFileSync("migrations/0002_full_d1_schema.sql", "utf8"));
    sqlite.exec(`
      INSERT INTO plans (id,name,slug,is_active,is_public,has_lifetime,price_monthly)
      VALUES (1,'Free','free',1,1,0,0),
             (2,'Starter','starter',1,1,1,5),
             (3,'Professional','professional',1,1,1,15);
      INSERT INTO users (id,email,name,role,plan_id,account_status,trial_started_at)
      VALUES (1,'customer@example.test','Customer','user',1,'free',datetime('now')),
             (2,'admin@example.test','Admin','admin',1,'active',NULL);
    `);
    const pinHash = await bcrypt.hash("1234", 4);
    sqlite.prepare("INSERT INTO admin_pins(admin_id,pin_hash,failed_attempts) VALUES (2,?,0)").run(pinHash);
    sqlite.prepare("INSERT INTO sessions(sid,data,expires_at) VALUES (?,?,?)").run(
      "admin-session",
      JSON.stringify({ adminUserId: 2, adminPinVerified: true, adminPinVerifiedAt: Date.now() }),
      Date.now() + 86_400_000,
    );
    d1 = new D1Database(sqlite);
  });

  afterEach(() => sqlite.close());

  async function challenge(action) {
    const { response, body } = await jsonResponse(await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/pin/challenge",
      { method: "POST", body: { pin: "1234", action } },
    )));
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.token).toMatch(/^[a-f0-9]{64}$/);
    return body.token;
  }

  it("grants and withdraws lifetime access from User & CRM with one-time billing challenges", async () => {
    const grantToken = await challenge("billing_control");
    const granted = await jsonResponse(await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/lifetime",
      { method: "POST", token: grantToken, action: "billing_control", body: { plan_id: 2, reason: "Director approved goodwill access" } },
    )));
    expect(granted.response.status).toBe(200);
    expect(granted.body.data).toMatchObject({ lifetime_access: 1, lifetime_plan_id: 2, plan_id: 2, account_status: "lifetime" });
    expect(sqlite.prepare("SELECT status,billing_interval FROM subscriptions WHERE user_id=1 ORDER BY id DESC LIMIT 1").get())
      .toMatchObject({ status: "lifetime", billing_interval: "lifetime" });

    const reused = await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/lifetime",
      { method: "POST", token: grantToken, action: "billing_control", body: { plan_id: 3, reason: "reuse should fail" } },
    ));
    expect(reused.status).toBe(403);

    const log = await jsonResponse(await handleAdminPlanApiRequest(context(d1, "/api/admin/users/1/lifetime-log")));
    expect(log.response.status).toBe(200);
    expect(log.body.data[0].action).toBe("granted");

    const revokeToken = await challenge("billing_control");
    const revoked = await jsonResponse(await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/lifetime",
      { method: "DELETE", token: revokeToken, action: "billing_control", body: { reason: "Administrative correction" } },
    )));
    expect(revoked.response.status).toBe(200);
    expect(revoked.body.data).toMatchObject({ lifetime_access: 0, plan_id: 1, account_status: "free" });
    expect(sqlite.prepare("SELECT COUNT(*) count FROM lifetime_access_log WHERE user_id=1").get().count).toBe(2);
  });

  it("assigns a normal plan only after an assign-plan PIN challenge", async () => {
    const withoutChallenge = await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/assign-plan",
      { method: "POST", body: { plan_id: 3 } },
    ));
    expect(withoutChallenge.status).toBe(403);

    const token = await challenge("assign_plan");
    const assigned = await jsonResponse(await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/assign-plan",
      { method: "POST", token, action: "assign_plan", body: { plan_id: 3, reason: "Approved admin entitlement" } },
    )));
    expect(assigned.response.status).toBe(200);
    expect(sqlite.prepare("SELECT plan_id,account_status FROM users WHERE id=1").get())
      .toMatchObject({ plan_id: 3, account_status: "paid_active" });
  });

  it("supports trial, Free, No Plan and direct status administration", async () => {
    let result = await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/trial/extend",
      { method: "POST", body: { days: 10, reason: "Support extension" } },
    ));
    expect(result.status).toBe(200);
    expect(sqlite.prepare("SELECT account_status FROM users WHERE id=1").get().account_status).toBe("trial_active");

    result = await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/users/1/trial/end",
      { method: "POST", body: { reason: "Trial complete" } },
    ));
    expect(result.status).toBe(200);
    expect(sqlite.prepare("SELECT account_status FROM users WHERE id=1").get().account_status).toBe("plan_selection");

    result = await handleAdminPlanApiRequest(context(d1, "/api/admin/users/1/move-to-free", { method: "POST", body: {} }));
    expect(result.status).toBe(200);
    expect(sqlite.prepare("SELECT plan_id,account_status FROM users WHERE id=1").get()).toMatchObject({ plan_id: 1, account_status: "free" });

    result = await handleAdminPlanApiRequest(context(d1, "/api/admin/users/1/move-to-no-plan", { method: "POST", body: {} }));
    expect(result.status).toBe(200);
    expect(sqlite.prepare("SELECT plan_id,account_status FROM users WHERE id=1").get()).toMatchObject({ plan_id: null, account_status: "no_plan" });

    result = await handleAdminPlanApiRequest(context(d1, "/api/admin/users/1/account-status", { method: "PATCH", body: { status: "suspended" } }));
    expect(result.status).toBe(200);
    expect(sqlite.prepare("SELECT account_status FROM users WHERE id=1").get().account_status).toBe("suspended");
  });

  it("lists subscriptions and restores the legacy plan visibility route", async () => {
    sqlite.prepare("INSERT INTO subscriptions(user_id,plan_id,status,billing_interval) VALUES (1,2,'active','monthly')").run();
    const subscriptions = await jsonResponse(await handleAdminPlanApiRequest(context(d1, "/api/admin/subscriptions")));
    expect(subscriptions.response.status).toBe(200);
    expect(subscriptions.body.data).toHaveLength(1);

    const toggled = await jsonResponse(await handleAdminPlanApiRequest(context(
      d1,
      "/api/admin/plans/2/toggle-public",
      { method: "PUT", body: {} },
    )));
    expect(toggled.response.status).toBe(200);
    expect(toggled.body.data.is_public).toBe(0);
  });
});
