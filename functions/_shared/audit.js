export async function writeAudit(database, request, actor, action, resourceType, details, result = "success") {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || null;
  await database.prepare(`
    INSERT INTO audit_log
      (actor_id, actor_name, actor_email, actor_type, action, resource_type,
       details, ip_address, user_agent, result, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
  `).bind(
    actor?.id ?? null,
    actor?.name ?? null,
    actor?.email ?? null,
    actor?.role === "admin" ? "admin" : "user",
    action,
    resourceType,
    details ?? null,
    forwarded,
    request.headers.get("user-agent"),
    result,
  ).run();
}

