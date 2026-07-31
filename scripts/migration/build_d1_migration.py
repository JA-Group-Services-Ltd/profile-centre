#!/usr/bin/env python3
"""Build and validate a sanitised Profile Centre SQLite-to-D1 migration.

The source database is read locally. Generated production data is written only
to the explicitly supplied output directory and must never be committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import tempfile
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "3"
MIGRATION_VERSION = "2026-07-31.1"
MAX_D1_COLUMNS = 100

# Records in these tables are authentication material or temporary security
# state. The table definitions remain available for the Cloudflare runtime,
# but their legacy rows are never copied.
EXCLUDED_TABLE_DATA = {
    "account_pins": "legacy customer PIN hashes",
    "admin_challenge_tokens": "temporary administrative authentication codes",
    "admin_pins": "legacy administrative PIN hashes",
    "oidc_state": "temporary OAuth/OIDC state and PKCE verifiers",
    "session_activity": "active session identifiers and device fingerprints",
    "sessions": "active login sessions and session cookies",
    "stripe_config": "legacy API credential/configuration store",
    "support_pins": "temporary support PINs",
}

# These columns are retained in the schema for application compatibility but
# are set to NULL for every migrated row.
REDACTED_COLUMNS = {
    "users": {"password_hash"},
    "profiles": {"pin_hash", "public_pin_hash"},
}

PROFILE_GROUPS = {
    "profiles": [
        "id", "user_id", "username", "display_name", "job_title", "company",
        "bio", "phone", "email", "website", "address", "profile_photo",
        "profile_type", "url_prefix", "biz_slug", "person_slug", "theme_id",
        "created_at", "updated_at", "is_published", "is_verified",
        "verified_at", "verified_by", "verification_requested_at",
        "verification_request_note", "is_suspended", "is_hidden",
        "suspended_at", "suspended_by", "suspension_reason", "hidden_at",
        "hidden_by",
    ],
    "profile_business_details": [
        "id", "business_name", "business_description", "business_category",
        "opening_hours", "logo_url", "cover_url", "services", "team_members",
        "announcements", "business_description_html", "business_tagline",
        "business_email", "business_phone", "business_website",
        "business_address", "max_seats", "business_type", "business_hours",
        "booking_url", "map_embed_url", "payment_methods", "featured_offer",
        "booking_link", "map_embed",
    ],
    "profile_public_content": [
        "id", "bio_html", "gallery", "awards", "faqs", "certifications",
        "testimonials", "cta_buttons", "headline", "skills", "languages",
        "education", "experience", "portfolio_url", "availability", "pronouns",
        "location_city", "cover_image", "social_channels", "content_niche",
        "speaking_topics", "coaching_areas", "volunteer_causes", "ministry_role",
        "publications", "collab_rate", "content_formats", "platforms", "gpa",
        "graduation_year", "internships", "clubs", "contact_email",
        "social_links", "menu_items", "menu_title", "pdf_attachments",
    ],
    "profile_configuration": [
        "id", "show_phone", "show_email", "show_website", "show_address",
        "show_bio", "team_directory_public", "pin_hash", "messaging_enabled",
        "enquiry_enabled", "allow_indexing", "seo_title", "seo_description",
        "public_pin_hash", "public_pin_enabled", "personal_type",
        "layout_preset", "colour_palette", "custom_colour", "button_style",
        "photo_shape", "avatar_url", "layout_style", "design_style",
        "color_scheme", "font_style", "cta_label", "cta_url",
        "show_contact_form", "show_qr_code", "plan_gated",
        "use_custom_editor", "whatsapp_url", "whatsapp_label",
        "whatsapp_enabled", "menu_enabled", "pdf_enabled", "gallery_enabled",
        "social_links_enabled", "search_directory_enabled",
    ],
}

ORDER_GROUPS = {
    "business_card_orders": [
        "id", "user_id", "profile_id", "status", "quantity", "finish", "sides",
        "name", "role", "phone", "email", "website", "logo_url",
        "brand_colour", "notes", "internal_notes", "provider", "provider_ref",
        "customer_approved", "customer_approved_at", "payment_status",
        "dispatch_tracking", "created_at", "updated_at", "request_type",
        "template_id", "card_type", "card_size", "corner_type",
        "customer_notes", "has_own_design", "delivery_address",
        "business_name_on_card",
    ],
    "business_card_order_design": [
        "id", "design_fee_amount", "design_fee_description",
        "design_fee_status", "fee_quoted_at", "fee_accepted_at",
        "fee_declined_at", "proof_url", "proof_sent_at", "design_type",
        "attached_image_url", "card_color", "card_accent", "card_layout",
        "name_on_card", "role_on_card", "phone_on_card", "email_on_card",
        "website_on_card", "tagline_on_card", "upload_urls", "template_data",
        "qr_code_url", "front_bg_color", "front_text_color",
        "front_accent_color", "font_choice", "brand_colors",
        "style_preference", "address_on_card", "social_links",
        "front_back_preference", "qr_required", "upload_front_url",
        "upload_back_url", "upload_file_type", "proof_download_count",
        "final_file_enabled", "final_file_url", "final_file_enabled_at",
        "final_file_enabled_by_admin_id",
    ],
    "business_card_order_financials": [
        "id", "provider_cost", "delivery_cost", "vat_amount", "handling_fee",
        "total_quoted", "stripe_payment_link", "stripe_link_sent_at",
        "stripe_payment_due_at", "stripe_payment_status", "stripe_payment_ref",
        "stripe_amount_requested", "stripe_amount_paid",
        "stripe_payment_notes", "payment_received_at", "stripe_invoice_id",
        "stripe_invoice_url", "stripe_invoice_status",
        "stripe_invoice_line_items", "stripe_invoice_due_date",
        "stripe_invoice_notes", "stripe_invoice_created_at",
        "stripe_invoice_sent_at", "artwork_prep_fee", "logo_placement_fee",
        "qr_setup_fee", "premium_finish_cost", "rush_fee",
        "design_deposit_amount", "design_deposit_paid",
        "design_deposit_paid_at", "vat_enabled_on_order", "vat_rate_on_order",
        "vat_amount_on_order",
    ],
}


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bytes):
        return "X'" + value.hex() + "'"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def source_tables(connection: sqlite3.Connection) -> list[str]:
    return [
        row[0]
        for row in connection.execute(
            """SELECT name FROM sqlite_master
               WHERE type='table' AND name NOT LIKE 'sqlite_%'
               ORDER BY name"""
        )
    ]


def table_columns(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(connection.execute(f"PRAGMA table_info({quote_identifier(table)})"))


def table_foreign_keys(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(connection.execute(f"PRAGMA foreign_key_list({quote_identifier(table)})"))


def validate_groups(connection: sqlite3.Connection, source: str, groups: dict[str, list[str]]) -> None:
    actual = {row["name"] for row in table_columns(connection, source)}
    grouped: list[str] = []
    for columns in groups.values():
        grouped.extend(columns[1:] if columns and columns[0] == "id" else columns)
    expected = {"id", *grouped}
    missing = sorted(actual - expected)
    unknown = sorted(expected - actual)
    duplicates = sorted({name for name in grouped if grouped.count(name) > 1})
    if missing or unknown or duplicates:
        raise ValueError(
            f"Invalid split for {source}: missing={missing}, unknown={unknown}, "
            f"duplicates={duplicates}"
        )


def transformed_layout(connection: sqlite3.Connection) -> dict[str, tuple[str, list[str]]]:
    validate_groups(connection, "profiles", PROFILE_GROUPS)
    validate_groups(connection, "business_card_orders", ORDER_GROUPS)
    result: dict[str, tuple[str, list[str]]] = {}
    for table in source_tables(connection):
        if table == "profiles":
            result.update({name: (table, cols) for name, cols in PROFILE_GROUPS.items()})
        elif table == "business_card_orders":
            result.update({name: (table, cols) for name, cols in ORDER_GROUPS.items()})
        else:
            result[table] = (table, [row["name"] for row in table_columns(connection, table)])
    return result


def column_definition(column: sqlite3.Row, force_nullable: bool = False) -> str:
    parts = [quote_identifier(column["name"])]
    if column["type"]:
        parts.append(column["type"])
    if column["notnull"] and not force_nullable:
        parts.append("NOT NULL")
    if column["dflt_value"] is not None:
        default = str(column["dflt_value"])
        if (
            "(" in default
            and not (default.startswith("(") and default.endswith(")"))
        ):
            default = f"({default})"
        parts.extend(["DEFAULT", default])
    if column["pk"] and column["pk"] == 1:
        parts.append("PRIMARY KEY")
    return " ".join(parts)


def create_table_sql(
    source: sqlite3.Connection,
    destination_table: str,
    source_table: str,
    selected_columns: list[str],
) -> str:
    info = {row["name"]: row for row in table_columns(source, source_table)}
    definitions = [
        column_definition(
            info[name],
            force_nullable=name in REDACTED_COLUMNS.get(source_table, set()),
        )
        for name in selected_columns
    ]
    primary_keys = sorted(
        (
            (info[name]["pk"], name)
            for name in selected_columns
            if info[name]["pk"]
        ),
        key=lambda item: item[0],
    )
    if len(primary_keys) > 1:
        definitions = [
            definition.replace(" PRIMARY KEY", "")
            for definition in definitions
        ]
        definitions.append(
            "PRIMARY KEY ("
            + ", ".join(quote_identifier(name) for _, name in primary_keys)
            + ")"
        )

    if destination_table != source_table:
        definitions.append(
            f"FOREIGN KEY ({quote_identifier('id')}) REFERENCES "
            f"{quote_identifier(source_table)} ({quote_identifier('id')}) "
            "ON DELETE CASCADE"
        )
    else:
        selected = set(selected_columns)
        for foreign_key in table_foreign_keys(source, source_table):
            if foreign_key["from"] not in selected:
                continue
            definitions.append(
                f"FOREIGN KEY ({quote_identifier(foreign_key['from'])}) REFERENCES "
                f"{quote_identifier(foreign_key['table'])} "
                f"({quote_identifier(foreign_key['to'])})"
                + (
                    f" ON UPDATE {foreign_key['on_update']}"
                    if foreign_key["on_update"] != "NO ACTION"
                    else ""
                )
                + (
                    f" ON DELETE {foreign_key['on_delete']}"
                    if foreign_key["on_delete"] != "NO ACTION"
                    else ""
                )
            )

    body = ",\n  ".join(definitions)
    return f"CREATE TABLE {quote_identifier(destination_table)} (\n  {body}\n);"


def unique_index_sql(
    source: sqlite3.Connection,
    layout: dict[str, tuple[str, list[str]]],
) -> list[str]:
    statements: list[str] = []
    destinations_by_source: dict[str, list[tuple[str, set[str]]]] = defaultdict(list)
    for destination, (source_table, columns) in layout.items():
        destinations_by_source[source_table].append((destination, set(columns)))

    for source_table in source_tables(source):
        for index in source.execute(f"PRAGMA index_list({quote_identifier(source_table)})"):
            if index["origin"] == "pk":
                continue
            columns = [
                row["name"]
                for row in source.execute(f"PRAGMA index_info({quote_identifier(index['name'])})")
            ]
            if not columns:
                continue
            for destination, destination_columns in destinations_by_source[source_table]:
                if set(columns).issubset(destination_columns):
                    unique = "UNIQUE " if index["unique"] else ""
                    safe_name = re.sub(r"[^A-Za-z0-9_]", "_", f"idx_{destination}_{'_'.join(columns)}")
                    statements.append(
                        f"CREATE {unique}INDEX IF NOT EXISTS {quote_identifier(safe_name)} "
                        f"ON {quote_identifier(destination)} "
                        f"({', '.join(quote_identifier(column) for column in columns)});"
                    )
                    break
    return statements


def dependency_order(source: sqlite3.Connection) -> list[str]:
    tables = source_tables(source)
    parents: dict[str, set[str]] = {
        table: {
            row["table"]
            for row in table_foreign_keys(source, table)
            if row["table"] in tables and row["table"] != table
        }
        for table in tables
    }
    children: dict[str, set[str]] = defaultdict(set)
    indegree = {table: len(parents[table]) for table in tables}
    for child, parent_set in parents.items():
        for parent in parent_set:
            children[parent].add(child)
    queue = deque(sorted(table for table, count in indegree.items() if count == 0))
    ordered: list[str] = []
    while queue:
        table = queue.popleft()
        ordered.append(table)
        for child in sorted(children[table]):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    # SQLite schemas can contain cycles. Retain a stable order for any cycle.
    ordered.extend(sorted(set(tables) - set(ordered)))
    return ordered


def copy_rows(
    source: sqlite3.Connection,
    destination: sqlite3.Connection,
    layout: dict[str, tuple[str, list[str]]],
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    counts: dict[str, int] = {}
    security_actions: list[dict[str, Any]] = []
    destinations_by_source: dict[str, list[tuple[str, list[str]]]] = defaultdict(list)
    for destination_table, (source_table, columns) in layout.items():
        destinations_by_source[source_table].append((destination_table, columns))

    for source_table in dependency_order(source):
        row_count = source.execute(
            f"SELECT COUNT(*) FROM {quote_identifier(source_table)}"
        ).fetchone()[0]
        if source_table in EXCLUDED_TABLE_DATA:
            counts.update(
                {destination: 0 for destination, _ in destinations_by_source[source_table]}
            )
            security_actions.append(
                {
                    "table": source_table,
                    "action": "excluded_all_rows",
                    "record_count": row_count,
                    "reason": EXCLUDED_TABLE_DATA[source_table],
                }
            )
            continue

        rows = list(source.execute(f"SELECT * FROM {quote_identifier(source_table)}"))
        for destination_table, columns in destinations_by_source[source_table]:
            placeholders = ", ".join("?" for _ in columns)
            insert = (
                f"INSERT INTO {quote_identifier(destination_table)} "
                f"({', '.join(quote_identifier(column) for column in columns)}) "
                f"VALUES ({placeholders})"
            )
            values = []
            redactions = REDACTED_COLUMNS.get(source_table, set())
            populated_redactions = 0
            for row in rows:
                output_row = []
                for column in columns:
                    value = row[column]
                    if column in redactions:
                        if value not in (None, ""):
                            populated_redactions += 1
                        value = None
                    output_row.append(value)
                values.append(tuple(output_row))
            if values:
                destination.executemany(insert, values)
            counts[destination_table] = len(values)
            for column in sorted(redactions.intersection(columns)):
                security_actions.append(
                    {
                        "table": source_table,
                        "field": column,
                        "action": "set_null",
                        "record_count": populated_redactions,
                        "reason": "legacy authentication secret or PIN hash",
                    }
                )
    return counts, security_actions


def write_data_sql(
    destination: sqlite3.Connection,
    output_path: Path,
    table_order: list[str],
) -> None:
    lines = ["PRAGMA foreign_keys = OFF;", "BEGIN TRANSACTION;"]
    for table in table_order:
        columns = [row["name"] for row in table_columns(destination, table)]
        for row in destination.execute(f"SELECT * FROM {quote_identifier(table)}"):
            lines.append(
                f"INSERT INTO {quote_identifier(table)} "
                f"({', '.join(quote_identifier(column) for column in columns)}) "
                f"VALUES ({', '.join(sql_literal(row[column]) for column in columns)});"
            )
    lines.extend(["COMMIT;", "PRAGMA foreign_keys = ON;"])
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-db", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--json-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    # Create a consistent local snapshot without modifying the source or WAL.
    with tempfile.TemporaryDirectory(prefix="profile-centre-source-") as temporary:
        snapshot_path = Path(temporary) / "source-snapshot.db"
        source_live = sqlite3.connect(f"file:{args.source_db}?mode=ro", uri=True)
        source_snapshot = sqlite3.connect(snapshot_path)
        source_live.backup(source_snapshot)
        source_live.close()
        source_snapshot.row_factory = sqlite3.Row
        source_snapshot.execute("PRAGMA foreign_keys = ON")

        integrity = source_snapshot.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"Source integrity check failed: {integrity}")

        tables = source_tables(source_snapshot)
        source_counts = {
            table: source_snapshot.execute(
                f"SELECT COUNT(*) FROM {quote_identifier(table)}"
            ).fetchone()[0]
            for table in tables
        }

        json_counts: dict[str, int] = {}
        for json_path in sorted(args.json_dir.glob("*.json")):
            if json_path.name == "export_manifest.json":
                continue
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            if not isinstance(payload, list):
                raise RuntimeError(f"{json_path.name} is not a JSON row array")
            json_counts[json_path.stem] = len(payload)
        if set(json_counts) != set(tables):
            raise RuntimeError(
                f"JSON/table mismatch: missing={sorted(set(tables)-set(json_counts))}, "
                f"extra={sorted(set(json_counts)-set(tables))}"
            )
        mismatched_json = {
            table: {"sqlite": source_counts[table], "json": json_counts[table]}
            for table in tables
            if source_counts[table] != json_counts[table]
        }
        if mismatched_json:
            raise RuntimeError(f"JSON record counts differ from SQLite: {mismatched_json}")

        users_total = source_counts.get("users", 0)
        entra_users = source_snapshot.execute(
            """SELECT COUNT(*) FROM users
               WHERE entra_oid IS NOT NULL AND TRIM(entra_oid) <> ''"""
        ).fetchone()[0]
        password_users = source_snapshot.execute(
            """SELECT COUNT(*) FROM users
               WHERE password_hash IS NOT NULL AND TRIM(password_hash) <> ''"""
        ).fetchone()[0]
        if users_total and entra_users != users_total:
            raise RuntimeError(
                f"Only {entra_users}/{users_total} users have Microsoft Entra identities"
            )

        layout = transformed_layout(source_snapshot)
        largest_columns = max(len(columns) for _, columns in layout.values())
        if largest_columns >= MAX_D1_COLUMNS:
            raise RuntimeError(
                f"Largest transformed table has {largest_columns} columns; "
                f"must be fewer than {MAX_D1_COLUMNS}"
            )

        schema_statements = [
            """CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);"""
        ] + [
            create_table_sql(source_snapshot, destination, source_table, columns)
            for destination, (source_table, columns) in layout.items()
        ]
        index_statements = unique_index_sql(source_snapshot, layout)
        schema_text = (
            "PRAGMA foreign_keys = ON;\n\n"
            + "\n\n".join(schema_statements + index_statements)
            + "\n"
        )
        schema_path = args.output_dir / "schema.sql"
        schema_path.write_text(schema_text, encoding="utf-8")

        destination_path = args.output_dir / "validated.db"
        if destination_path.exists():
            destination_path.unlink()
        destination = sqlite3.connect(destination_path)
        destination.row_factory = sqlite3.Row
        destination.executescript(schema_text)
        destination.execute("PRAGMA foreign_keys = ON")
        destination_counts, security_actions = copy_rows(
            source_snapshot, destination, layout
        )

        exported_at = manifest.get("exported_at")
        import_id = "profile-centre-airo-" + hashlib.sha256(
            (
                str(exported_at)
                + "|"
                + "|".join(f"{key}:{source_counts[key]}" for key in sorted(source_counts))
            ).encode("utf-8")
        ).hexdigest()[:16]
        completed_at = datetime.now(timezone.utc).isoformat()
        metadata = {
            "schema_version": SCHEMA_VERSION,
            "production_import_id": import_id,
            "production_import_completed_at": completed_at,
            "source_export_timestamp": str(exported_at or ""),
            "source_table_count": str(len(tables)),
            "imported_record_count": str(sum(destination_counts.values())),
            "migration_version": MIGRATION_VERSION,
        }
        for key, value in metadata.items():
            destination.execute(
                """INSERT INTO app_settings (key, value)
                   VALUES (?, ?)
                   ON CONFLICT(key) DO UPDATE SET
                     value=excluded.value,
                     updated_at=CURRENT_TIMESTAMP""",
                (key, value),
            )
        destination_counts["app_settings"] = destination.execute(
            "SELECT COUNT(*) FROM app_settings"
        ).fetchone()[0]
        destination.commit()

        fk_errors = [dict(row) for row in destination.execute("PRAGMA foreign_key_check")]
        integrity_destination = destination.execute("PRAGMA integrity_check").fetchone()[0]
        duplicate_errors: dict[str, int] = {}
        for table in source_tables(destination):
            primary_keys = [
                row["name"] for row in table_columns(destination, table) if row["pk"]
            ]
            if not primary_keys:
                continue
            expressions = ", ".join(quote_identifier(column) for column in primary_keys)
            duplicates = destination.execute(
                f"""SELECT COUNT(*) FROM (
                      SELECT {expressions}, COUNT(*) count
                      FROM {quote_identifier(table)}
                      GROUP BY {expressions}
                      HAVING count > 1
                    )"""
            ).fetchone()[0]
            if duplicates:
                duplicate_errors[table] = duplicates

        expected_destination_counts = dict(destination_counts)
        actual_destination_counts = {
            table: destination.execute(
                f"SELECT COUNT(*) FROM {quote_identifier(table)}"
            ).fetchone()[0]
            for table in source_tables(destination)
        }
        count_mismatches = {
            table: {
                "expected": expected_destination_counts.get(table),
                "actual": count,
            }
            for table, count in actual_destination_counts.items()
            if expected_destination_counts.get(table) != count
        }

        if (
            fk_errors
            or duplicate_errors
            or count_mismatches
            or integrity_destination != "ok"
        ):
            raise RuntimeError(
                "Local validation failed: "
                f"fk={len(fk_errors)}, duplicates={duplicate_errors}, "
                f"count_mismatches={count_mismatches}, "
                f"integrity={integrity_destination}"
            )

        destination_order = [
            table for table in dependency_order(destination)
            if table in actual_destination_counts
        ]
        write_data_sql(destination, args.output_dir / "data.sql", destination_order)

        deliberately_excluded_records = sum(
            action["record_count"]
            for action in security_actions
            if action["action"] == "excluded_all_rows"
        )
        report = {
            "status": "validated",
            "schema_version": SCHEMA_VERSION,
            "migration_version": MIGRATION_VERSION,
            "source_export_timestamp": exported_at,
            "source_table_count": len(tables),
            "source_record_count": sum(source_counts.values()),
            "source_counts": source_counts,
            "json_counts_match_sqlite": True,
            "manifest_table_count": manifest.get("total_tables"),
            "destination_table_count": len(actual_destination_counts),
            "destination_record_count": sum(actual_destination_counts.values()),
            "destination_counts": actual_destination_counts,
            "largest_destination_table_column_count": largest_columns,
            "entra_identity_users": entra_users,
            "source_users": users_total,
            "populated_password_hashes": password_users,
            "deliberately_excluded_records": deliberately_excluded_records,
            "security_actions": security_actions,
            "validation": {
                "source_integrity": integrity,
                "destination_integrity": integrity_destination,
                "foreign_key_errors": len(fk_errors),
                "duplicate_key_errors": sum(duplicate_errors.values()),
                "record_count_mismatches": len(count_mismatches),
                "unexplained_record_loss": 0,
            },
            "production_import_id": import_id,
        }
        (args.output_dir / "migration-report.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        destination.close()
        source_snapshot.close()

    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
