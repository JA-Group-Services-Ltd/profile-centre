import fs from "node:fs";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { ensureHeadOfficeEventOutbox } from "../functions/_shared/head-office-schema.js";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) { return new D1Statement(this.database, this.sql, values); }
  statement() {
    const bindings = {};
    this.values.forEach((value, index) => { bindings[index + 1] = value; });
    return { prepared: this.database.prepare(this.sql), bindings };
  }
  first() {
    const { prepared, bindings } = this.statement();
    return prepared.get(bindings) ?? null;
  }
  all() {
    const { prepared, bindings } = this.statement();
    return { success: true, results: prepared.all(bindings) };
  }
  run() {
    const { prepared, bindings } = this.statement();
    const result = prepared.run(bindings);
    return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
  }
}

class D1Database {
  constructor(database) { this.database = database; }
  prepare(sql) { return new D1Statement(this.database, sql); }
}

const databases = [];
function memoryD1() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  return { sqlite, d1: new D1Database(sqlite) };
}

afterEach(() => {
  while (databases.length) databases.pop().close();
});

describe("Head Office operational event outbox", () => {
  it("creates the missing production outbox with every field used by the event sender", async () => {
    const { sqlite, d1 } = memoryD1();
    await ensureHeadOfficeEventOutbox(d1);

    const columns = sqlite.prepare("PRAGMA table_info(head_office_event_outbox)").all().map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining([
      "event_id", "user_id", "event_type", "payload_json", "correlation_id",
      "status", "attempts", "last_attempt_at", "next_attempt_at", "sent_at",
      "completed_at", "error", "created_at",
    ]));

    sqlite.prepare(`INSERT INTO head_office_event_outbox
      (event_id,user_id,event_type,payload_json,correlation_id,next_attempt_at)
      VALUES ('evt-1',1,'profile.updated','{}','corr-1',CURRENT_TIMESTAMP)`).run();
    sqlite.prepare(`UPDATE head_office_event_outbox
      SET status='sent',attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP,
          sent_at=CURRENT_TIMESTAMP,completed_at=CURRENT_TIMESTAMP,error=NULL
      WHERE event_id='evt-1'`).run();

    const row = sqlite.prepare("SELECT status,attempts FROM head_office_event_outbox WHERE event_id='evt-1'").get();
    expect(row).toEqual({ status: "sent", attempts: 1 });
  });

  it("repairs an older partial outbox instead of leaving profile saves broken", async () => {
    const { sqlite, d1 } = memoryD1();
    sqlite.exec("CREATE TABLE head_office_event_outbox (event_id TEXT)");

    await ensureHeadOfficeEventOutbox(d1);

    const columns = new Set(sqlite.prepare("PRAGMA table_info(head_office_event_outbox)").all().map((row) => row.name));
    for (const required of ["user_id", "event_type", "payload_json", "status", "attempts", "next_attempt_at", "error", "created_at"]) {
      expect(columns.has(required)).toBe(true);
    }
  });

  it("keeps the runtime guard wired into every Cloudflare API request", () => {
    const router = fs.readFileSync("functions/[[path]].js", "utf8");
    expect(router).toMatch(/ensureHeadOfficeEventOutbox/);
    expect(router).toMatch(/if \(context\.env\.DB\) await ensureHeadOfficeEventOutbox\(context\.env\.DB\)/);
  });

  it("ships a canonical D1 migration for fresh environments", () => {
    const migration = fs.readFileSync("migrations/20260808_head_office_event_outbox.sql", "utf8");
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS head_office_event_outbox/);
    expect(migration).toMatch(/event_id TEXT PRIMARY KEY/);
    expect(migration).toMatch(/idx_head_office_event_outbox_pending/);
  });
});
