import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";

export async function accountClosure(request, database, user, method) {
  if (method === "GET") {
    const row = await database.prepare(`
      SELECT id, reason, status, admin_note, confirmed_at, created_at, updated_at
      FROM account_closure_requests WHERE user_id = ?1
      ORDER BY created_at DESC, id DESC LIMIT 1
    `).bind(user.id).first();
    return { success: true, data: row ?? null };
  }
  if (method === "DELETE") {
    const result = await database.prepare(`
      UPDATE account_closure_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?1 AND status = 'pending'
    `).bind(user.id).run();
    if (!Number(result.meta?.changes ?? 0)) {
      throw new HttpError(404, "No pending closure request found.", "closure_request_not_found");
    }
    await writeAudit(database, request, user, "account_closure_cancelled", "user",
      "Cancelled account closure request");
    return { success: true, message: "Closure request cancelled." };
  }
  const body = await readJson(request);
  const existing = await database.prepare(`
    SELECT id FROM account_closure_requests WHERE user_id = ?1 AND status = 'pending' LIMIT 1
  `).bind(user.id).first();
  if (existing) {
    throw new HttpError(409, "You already have a pending closure request.", "closure_request_exists");
  }
  await database.prepare(`
    INSERT INTO account_closure_requests (user_id, reason, status, created_at, updated_at)
    VALUES (?1, ?2, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(user.id, body.reason == null ? null : String(body.reason).slice(0, 2000)).run();
  await writeAudit(database, request, user, "account_closure_requested", "user",
    "Submitted account closure request");
  return {
    success: true,
    message: "Closure request submitted. We will review and confirm within 5 business days.",
  };
}

export async function dataRequests(request, database, user, method) {
  if (method === "GET") {
    const result = await database.prepare(`
      SELECT id, request_type, status, description, created_at, updated_at, completed_at
      FROM data_requests WHERE user_id = ?1 ORDER BY created_at DESC, id DESC
    `).bind(user.id).all();
    return { success: true, data: result.results };
  }
  const body = await readJson(request);
  const requestType = String(body.request_type ?? body.type ?? "");
  if (!["access", "rectification", "erasure", "restriction", "portability", "objection"].includes(requestType)) {
    throw new HttpError(400, "Unsupported data request type.", "validation_error");
  }
  const row = await database.prepare(`
    INSERT INTO data_requests (user_id, request_type, status, description, created_at, updated_at)
    VALUES (?1, ?2, 'pending', ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *
  `).bind(user.id, requestType, body.details == null ? null : String(body.details).slice(0, 4000)).first();
  await writeAudit(database, request, user, "data_request_submitted", "data_request",
    `Submitted ${requestType} request`);
  return { success: true, data: row };
}
