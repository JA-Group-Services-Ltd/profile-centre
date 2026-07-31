#!/usr/bin/env python3
"""Build a sanitised migration inventory from the legacy Express router."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENTRY = ROOT / "src/server/entry.ts"
SCHEMA = ROOT / "migrations/0002_full_d1_schema.sql"
OUTPUT = ROOT / "docs/CLOUDFLARE_API_ROUTE_INVENTORY.md"

PORTABLE_PATTERNS = {
    "/api/health",
    "/api/plans",
    "/api/themes",
    "/api/platform-features",
    "/api/feature-plan-rules",
    "/api/legal-policies",
    "/api/public-settings",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/profiles/me",
    "/api/profiles",
    "/api/profiles/:id",
    "/api/links/:profileId",
    "/api/links",
    "/api/links/reorder",
    "/api/subscriptions",
    "/api/account/closure-request",
    "/api/me/data-requests",
    "/api/business-cards",
    "/api/business-cards/feature-flag",
    "/api/users/me/preferences",
    "/api/account/settings",
    "/api/admin/plans",
    "/api/admin/plans/:id",
    "/api/admin/themes",
    "/api/admin/features",
    "/api/admin/feature-plan-rules",
    "/api/admin/users",
    "/api/admin/profiles",
    "/api/admin/audit",
    "/api/admin/settings",
    "/auth/login",
    "/auth/callback",
    "/auth/logout",
    "/admin/auth/start",
    "/admin/auth/callback",
    "/admin/logout",
}


def normalise_path(path: str) -> str:
    path = re.sub(r"\$\{[^}]+\}", ":param", path)
    return path.split("?")[0]


def imports(source: str) -> dict[str, Path]:
    result: dict[str, Path] = {}
    pattern = re.compile(
        r'import\s+(?P<symbols>[\s\S]*?)\s+from\s+["\'](?P<path>\.[^"\']+)["\'];',
        re.MULTILINE,
    )
    for match in pattern.finditer(source):
        module = (ENTRY.parent / match.group("path")).resolve()
        if not module.exists():
            module_base = module.with_suffix("") if module.suffix in {".js", ".mjs"} else module
            for suffix in (".ts", ".tsx", ".js"):
                candidate = module_base.with_suffix(suffix)
                if candidate.exists():
                    module = candidate
                    break
        symbols = match.group("symbols").strip()
        if symbols.startswith("{"):
            for item in symbols.strip("{} \r\n").split(","):
                item = item.strip()
                if not item or item.startswith("type "):
                    continue
                item = item.removeprefix("type ").strip()
                parts = re.split(r"\s+as\s+", item)
                result[parts[-1].strip()] = module
        else:
            default_name = symbols.split(",")[0].strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", default_name):
                result[default_name] = module
    return result


def frontend_callers() -> list[tuple[str, str]]:
    callers: list[tuple[str, str]] = []
    for source_file in (ROOT / "src").rglob("*"):
        if source_file.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        text = source_file.read_text(encoding="utf-8", errors="ignore")
        for match in re.finditer(r"""fetch\(\s*[`"'](?P<path>/api/[^`"']+)""", text):
            callers.append((normalise_path(match.group("path")), source_file.relative_to(ROOT).as_posix()))
    return callers


def caller_matches(route: str, candidate: str) -> bool:
    route_re = re.escape(route)
    route_re = re.sub(r"\\:[A-Za-z_][A-Za-z0-9_]*", r"[^/]+", route_re)
    route_re = route_re.replace(r"\:param", "[^/]+")
    return bool(re.fullmatch(route_re, candidate))


def table_names() -> list[str]:
    schema = SCHEMA.read_text(encoding="utf-8")
    return sorted(set(re.findall(r'CREATE TABLE IF NOT EXISTS\s+"?([A-Za-z0-9_]+)"?', schema)))


def handler_source(arguments: str, imported: dict[str, Path]) -> Path:
    tokens = re.findall(r"\b[A-Za-z_$][\w$]*\b", arguments)
    for token in reversed(tokens):
        if token in imported:
            return imported[token]
    return ENTRY


def tables_for(source_file: Path, tables: list[str]) -> str:
    if not source_file.exists():
        return "**Missing source module**"
    text = source_file.read_text(encoding="utf-8", errors="ignore")
    found = [table for table in tables if re.search(rf"\b{re.escape(table)}\b", text)]
    return ", ".join(f"`{table}`" for table in found) or "Undetermined"


def main() -> None:
    source = ENTRY.read_text(encoding="utf-8")
    imported = imports(source)
    callers = frontend_callers()
    tables = table_names()
    registrations = []
    route_pattern = re.compile(
        r'app\.(?P<method>get|post|put|patch|delete)\(\s*'
        r'(?P<quote>["\'])(?P<path>.+?)(?P=quote)\s*,(?P<args>.*)$',
        re.MULTILINE,
    )
    for match in route_pattern.finditer(source):
        route = normalise_path(match.group("path"))
        args = match.group("args")
        source_file = handler_source(args, imported)
        if "requireAdminApi" in args or "requireAdmin" in args:
            auth = "Admin session"
            role = "admin"
            if "requireAdminPin" in args:
                role += " + support PIN"
        elif "requireAuth" in args:
            auth = "Customer session"
            role = "authenticated user"
        else:
            auth = "Public"
            role = "none"
        route_callers = sorted({file for path, file in callers if caller_matches(route, path)})
        status = "Cloudflare equivalent implemented" if route in PORTABLE_PATTERNS else "Not yet migrated"
        registrations.append(
            {
                "method": match.group("method").upper(),
                "route": route,
                "auth": auth,
                "role": role,
                "source": source_file.relative_to(ROOT).as_posix(),
                "source_exists": source_file.exists(),
                "tables": tables_for(source_file, tables),
                "callers": "<br>".join(f"`{item}`" for item in route_callers) or "No static caller found",
                "status": status,
            }
        )

    registrations.sort(key=lambda item: (item["route"], item["method"]))
    migrated = sum(item["status"].startswith("Cloudflare") for item in registrations)
    lines = [
        "# Cloudflare API route inventory",
        "",
        "Generated from `src/server/entry.ts` and frontend `fetch('/api/...')` call sites.",
        "Table access is conservatively inferred from each route handler's source module;",
        "`Undetermined` means the registration uses an inline handler or indirection that needs manual review.",
        "",
        f"- Express route registrations: **{len(registrations)}**",
        f"- Cloudflare equivalents currently implemented: **{migrated}**",
        f"- Registrations still requiring migration or explicit retirement: **{len(registrations) - migrated}**",
        f"- Registrations referencing missing source modules: **{sum(not item['source_exists'] for item in registrations)}**",
        "",
        "| Method | Route | Authentication | Required role | Express source | Tables referenced | Frontend callers | Cloudflare status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for item in registrations:
        values = [
            item["method"],
            f"`{item['route']}`",
            item["auth"],
            item["role"],
            f"`{item['source']}`" if item["source_exists"] else f"**Missing:** `{item['source']}`",
            item["tables"],
            item["callers"],
            item["status"],
        ]
        lines.append("| " + " | ".join(value.replace("|", "\\|") for value in values) + " |")
    lines.extend(
        [
            "",
            "## Migration rule",
            "",
            "The legacy Express backend remains in the repository. A route may only be removed",
            "after its Cloudflare equivalent has contract tests and preview verification, or after",
            "the product owner explicitly confirms that the route is retired.",
            "",
        ]
    )
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(registrations)} routes")


if __name__ == "__main__":
    main()
