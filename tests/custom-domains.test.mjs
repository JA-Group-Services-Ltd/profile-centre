import fs from "node:fs";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureCustomDomainPlanPolicy, planAllowsCustomDomain } from "../functions/_shared/custom-domain-policy.js";
import { normaliseCustomHostname } from "../functions/_shared/custom-domains.js";

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

describe("Sousa Murray Profiles custom domains", () => {
  let sqlite;
  let d1;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(fs.readFileSync("migrations/0002_full_d1_schema.sql", "utf8"));
    sqlite.exec(`
      INSERT INTO plans (id,name,slug,price_monthly,max_links,is_active,is_public,has_custom_domain)
      VALUES
        (1,'Free','free',0,5,1,1,1),
        (2,'Starter','starter',5,20,1,1,1),
        (3,'Professional','professional',15,100,1,1,0),
        (4,'Organisation','business',29,100,1,1,0),
        (5,'Ultimate Organisation','ultimate_business',79,100,1,1,0),
        (6,'Ultimate Organisation+','ultimate_plus',99,100,1,1,0);
    `);
    d1 = new D1Database(sqlite);
  });

  afterEach(() => sqlite.close());

  it("enforces the four eligible plans and applies the price update once", async () => {
    await ensureCustomDomainPlanPolicy(d1);
    await ensureCustomDomainPlanPolicy(d1);

    const plans = sqlite.prepare(`SELECT slug,price_monthly,has_custom_domain FROM plans ORDER BY id`).all();
    expect(plans).toEqual([
      { slug: "free", price_monthly: 0, has_custom_domain: 0 },
      { slug: "starter", price_monthly: 5, has_custom_domain: 0 },
      { slug: "professional", price_monthly: 16, has_custom_domain: 1 },
      { slug: "business", price_monthly: 30, has_custom_domain: 1 },
      { slug: "ultimate_business", price_monthly: 80, has_custom_domain: 1 },
      { slug: "ultimate_plus", price_monthly: 100, has_custom_domain: 1 },
    ]);
    expect(sqlite.prepare(`SELECT value FROM app_settings WHERE key='custom_domain_plan_pricing_v1'`).get().value).toBe("applied");
    expect(planAllowsCustomDomain({ slug: "professional" })).toBe(true);
    expect(planAllowsCustomDomain({ slug: "starter" })).toBe(false);
  });

  it("accepts customer subdomains and rejects apex or platform hostnames", () => {
    expect(normaliseCustomHostname("profile.example.co.uk")).toBe("profile.example.co.uk");
    expect(normaliseCustomHostname("https://me.example.com/path")).toBe("me.example.com");
    expect(() => normaliseCustomHostname("example.co.uk")).toThrow(/subdomain/i);
    expect(() => normaliseCustomHostname("example.com")).toThrow(/subdomain/i);
    expect(() => normaliseCustomHostname("profile.jagroupservices.co.uk")).toThrow(/cannot be claimed/i);
    expect(() => normaliseCustomHostname("example.pages.dev")).toThrow(/cannot be claimed/i);
  });
});
