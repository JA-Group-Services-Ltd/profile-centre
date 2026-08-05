-- Sousa Murray Profiles full D1 schema
-- Schema version: 3
-- Data-free; generated from the verified Airo SQLite schema.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "account_closure_requests" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "admin_note" TEXT,
  "confirmed_by" INTEGER,
  "confirmed_by_name" TEXT,
  "confirmed_at" DATETIME,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("confirmed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account_pins" (
  "user_id" INTEGER PRIMARY KEY,
  "pin_hash" TEXT NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "addons" (
  "id" INTEGER PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL DEFAULT 0,
  "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "is_visible" INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 99,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "admin_challenge_tokens" (
  "token" TEXT PRIMARY KEY,
  "admin_id" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_pins" (
  "admin_id" INTEGER PRIMARY KEY,
  "pin_hash" TEXT NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "admin_settings" (
  "id" INTEGER PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "admin_user_notes" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "admin_id" INTEGER,
  "admin_name" TEXT,
  "note" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "affiliate_applications" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "website" TEXT,
  "audience" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "commission_rate" REAL DEFAULT 10.0,
  "affiliate_code" TEXT,
  "approved_at" DATETIME,
  "rejected_at" DATETIME,
  "rejection_reason" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
  "id" INTEGER PRIMARY KEY,
  "affiliate_id" INTEGER NOT NULL,
  "referred_user_id" INTEGER,
  "stripe_subscription_id" TEXT,
  "plan_name" TEXT,
  "amount_gbp" REAL NOT NULL DEFAULT 0,
  "commission_gbp" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" DATETIME,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("referred_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("affiliate_id") REFERENCES "affiliate_applications" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "assisted_access_requests" (
  "id" INTEGER PRIMARY KEY,
  "admin_id" INTEGER NOT NULL,
  "admin_name" TEXT,
  "admin_email" TEXT,
  "user_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "access_areas" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "session_token" TEXT,
  "session_expires_at" TEXT,
  "approved_at" TEXT,
  "rejected_at" TEXT,
  "revoked_at" TEXT,
  "exited_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "session_started_at" TEXT,
  "launch_token" TEXT,
  "launch_token_expires_at" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" INTEGER PRIMARY KEY,
  "actor_id" INTEGER,
  "actor_name" TEXT,
  "actor_email" TEXT,
  "actor_type" TEXT NOT NULL DEFAULT 'user',
  "tenant" TEXT,
  "auth_provider" TEXT,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL DEFAULT '',
  "resource_id" TEXT,
  "resource_label" TEXT,
  "details" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "result" TEXT NOT NULL DEFAULT 'success',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "severity" TEXT DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS "audit_log_v1" (
  "id" INTEGER PRIMARY KEY,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "actor_type" TEXT NOT NULL DEFAULT 'user',
  "user_agent" TEXT,
  "actor_id" INTEGER,
  "actor_name" TEXT,
  "actor_email" TEXT,
  "tenant" TEXT,
  "auth_provider" TEXT,
  "result" TEXT NOT NULL DEFAULT 'success',
  "ip_address" TEXT,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "severity" TEXT DEFAULT 'info',
  "resource_label" TEXT
);

CREATE TABLE IF NOT EXISTS "blocked_ips" (
  "id" INTEGER PRIMARY KEY,
  "ip_address" TEXT NOT NULL,
  "reason" TEXT,
  "blocked_by_admin_id" INTEGER,
  "blocked_by_name" TEXT,
  "thread_id" INTEGER,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "expires_at" DATETIME,
  FOREIGN KEY ("thread_id") REFERENCES "card_message_threads" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("blocked_by_admin_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "business_card_messages" (
  "id" INTEGER PRIMARY KEY,
  "order_id" INTEGER NOT NULL,
  "sender_type" TEXT NOT NULL,
  "sender_name" TEXT,
  "message" TEXT NOT NULL,
  "is_read" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("order_id") REFERENCES "business_card_orders" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "business_card_orders" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "profile_id" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "quantity" INTEGER DEFAULT 50,
  "finish" TEXT DEFAULT 'matte',
  "sides" TEXT DEFAULT 'double',
  "name" TEXT,
  "role" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "logo_url" TEXT,
  "brand_colour" TEXT,
  "notes" TEXT,
  "internal_notes" TEXT,
  "provider" TEXT,
  "provider_ref" TEXT,
  "customer_approved" INTEGER DEFAULT 0,
  "customer_approved_at" DATETIME,
  "payment_status" TEXT DEFAULT 'unpaid',
  "dispatch_tracking" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "request_type" TEXT DEFAULT 'builder',
  "template_id" INTEGER,
  "card_type" TEXT DEFAULT 'standard',
  "card_size" TEXT DEFAULT '85x55',
  "corner_type" TEXT DEFAULT 'square',
  "customer_notes" TEXT,
  "has_own_design" INTEGER DEFAULT 0,
  "delivery_address" TEXT,
  "business_name_on_card" TEXT,
  FOREIGN KEY ("template_id") REFERENCES "card_templates" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "business_card_order_design" (
  "id" INTEGER PRIMARY KEY,
  "design_fee_amount" REAL DEFAULT 0,
  "design_fee_description" TEXT,
  "design_fee_status" TEXT DEFAULT 'none',
  "fee_quoted_at" DATETIME,
  "fee_accepted_at" DATETIME,
  "fee_declined_at" DATETIME,
  "proof_url" TEXT,
  "proof_sent_at" DATETIME,
  "design_type" TEXT DEFAULT 'human',
  "attached_image_url" TEXT,
  "card_color" TEXT DEFAULT '#1e3a5f',
  "card_accent" TEXT DEFAULT '#c8a96e',
  "card_layout" TEXT DEFAULT 'classic',
  "name_on_card" TEXT,
  "role_on_card" TEXT,
  "phone_on_card" TEXT,
  "email_on_card" TEXT,
  "website_on_card" TEXT,
  "tagline_on_card" TEXT,
  "upload_urls" TEXT,
  "template_data" TEXT,
  "qr_code_url" TEXT,
  "front_bg_color" TEXT,
  "front_text_color" TEXT,
  "front_accent_color" TEXT,
  "font_choice" TEXT DEFAULT 'Inter',
  "brand_colors" TEXT,
  "style_preference" TEXT,
  "address_on_card" TEXT,
  "social_links" TEXT,
  "front_back_preference" TEXT DEFAULT 'double',
  "qr_required" INTEGER DEFAULT 1,
  "upload_front_url" TEXT,
  "upload_back_url" TEXT,
  "upload_file_type" TEXT,
  "proof_download_count" INTEGER DEFAULT 0,
  "final_file_enabled" INTEGER DEFAULT 0,
  "final_file_url" TEXT,
  "final_file_enabled_at" DATETIME,
  "final_file_enabled_by_admin_id" INTEGER,
  FOREIGN KEY ("id") REFERENCES "business_card_orders" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "business_card_order_financials" (
  "id" INTEGER PRIMARY KEY,
  "provider_cost" REAL DEFAULT 0,
  "delivery_cost" REAL DEFAULT 0,
  "vat_amount" REAL DEFAULT 0,
  "handling_fee" REAL DEFAULT 0,
  "total_quoted" REAL DEFAULT 0,
  "stripe_payment_link" TEXT,
  "stripe_link_sent_at" DATETIME,
  "stripe_payment_due_at" DATETIME,
  "stripe_payment_status" TEXT DEFAULT 'not_sent',
  "stripe_payment_ref" TEXT,
  "stripe_amount_requested" REAL DEFAULT 0,
  "stripe_amount_paid" REAL DEFAULT 0,
  "stripe_payment_notes" TEXT,
  "payment_received_at" DATETIME,
  "stripe_invoice_id" TEXT,
  "stripe_invoice_url" TEXT,
  "stripe_invoice_status" TEXT DEFAULT 'not_required',
  "stripe_invoice_line_items" TEXT,
  "stripe_invoice_due_date" TEXT,
  "stripe_invoice_notes" TEXT,
  "stripe_invoice_created_at" DATETIME,
  "stripe_invoice_sent_at" DATETIME,
  "artwork_prep_fee" REAL DEFAULT 0,
  "logo_placement_fee" REAL DEFAULT 0,
  "qr_setup_fee" REAL DEFAULT 0,
  "premium_finish_cost" REAL DEFAULT 0,
  "rush_fee" REAL DEFAULT 0,
  "design_deposit_amount" REAL DEFAULT 0,
  "design_deposit_paid" INTEGER DEFAULT 0,
  "design_deposit_paid_at" DATETIME,
  "vat_enabled_on_order" INTEGER DEFAULT 0,
  "vat_rate_on_order" REAL DEFAULT 0,
  "vat_amount_on_order" REAL DEFAULT 0,
  FOREIGN KEY ("id") REFERENCES "business_card_orders" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "business_seat_invites" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "invited_by" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'member',
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "expires_at" DATETIME DEFAULT (datetime('now', '+7 days')),
  FOREIGN KEY ("invited_by") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "business_seats" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "card_message_threads" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "sender_name" TEXT NOT NULL,
  "sender_email" TEXT NOT NULL,
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "last_message_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "sender_ip" TEXT,
  "severity" TEXT DEFAULT 'normal',
  "auto_flagged" INTEGER DEFAULT 0,
  "flag_reason" TEXT,
  "is_reported" INTEGER DEFAULT 0,
  "report_reason" TEXT,
  "reported_at" TEXT,
  "visitor_token" TEXT,
  "visitor_verified" INTEGER DEFAULT 0,
  "visitor_accepted" INTEGER DEFAULT 0,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "card_messages" (
  "id" INTEGER PRIMARY KEY,
  "thread_id" INTEGER NOT NULL,
  "sender" TEXT NOT NULL DEFAULT 'visitor',
  "body" TEXT NOT NULL,
  "is_read" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "sender_type" TEXT,
  "sender_name" TEXT,
  FOREIGN KEY ("thread_id") REFERENCES "card_message_threads" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "card_templates" (
  "id" INTEGER PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "is_premium" INTEGER NOT NULL DEFAULT 0,
  "front_bg_color" TEXT DEFAULT '#1e3a5f',
  "front_text_color" TEXT DEFAULT '#ffffff',
  "front_accent_color" TEXT DEFAULT '#c8a96e',
  "back_bg_color" TEXT DEFAULT '#ffffff',
  "back_text_color" TEXT DEFAULT '#1e3a5f',
  "layout_style" TEXT DEFAULT 'classic',
  "supports_back" INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 99,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "complaints" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER,
  "reference" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "status" TEXT NOT NULL DEFAULT 'open',
  "summary" TEXT NOT NULL,
  "handler_name" TEXT,
  "escalation_status" TEXT DEFAULT 'none',
  "resolution_date" DATETIME,
  "internal_notes" TEXT,
  "customer_response" TEXT,
  "outcome" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "contact_enquiries" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "sender_name" TEXT NOT NULL,
  "sender_email" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "consent_given_at" DATETIME,
  "sender_ip" TEXT DEFAULT NULL,
  "sender_user_agent" TEXT DEFAULT NULL,
  "is_vpn" INTEGER DEFAULT NULL,
  "vpn_check_detail" TEXT DEFAULT NULL,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "custom_domains" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "profile_id" INTEGER,
  "domain" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_connected',
  "dns_status" TEXT DEFAULT 'pending',
  "ssl_status" TEXT DEFAULT 'pending',
  "dns_verified_at" DATETIME,
  "ssl_activated_at" DATETIME,
  "activated_at" DATETIME,
  "failure_reason" TEXT,
  "suspended_at" DATETIME,
  "suspended_by" TEXT,
  "removed_at" DATETIME,
  "removed_by" TEXT,
  "admin_notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "connection_method" TEXT DEFAULT NULL,
  "manual_approval_reason" TEXT DEFAULT NULL,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "customer_addons" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "addon_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "assigned_by" TEXT,
  "assigned_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "expires_at" DATETIME,
  "cancelled_at" DATETIME,
  "notes" TEXT,
  FOREIGN KEY ("addon_id") REFERENCES "addons" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "customer_feature_overrides" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "feature_id" INTEGER NOT NULL,
  "access_type" TEXT NOT NULL DEFAULT 'hidden',
  "notes" TEXT,
  "set_by_admin_id" INTEGER,
  "set_by_admin_name" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("set_by_admin_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("feature_id") REFERENCES "platform_features" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER,
  "email" TEXT NOT NULL,
  "requested_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "completed_at" DATETIME,
  "status" TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "data_requests" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "request_type" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "assigned_to" INTEGER,
  "assigned_name" TEXT,
  "internal_notes" TEXT,
  "completed_at" DATETIME,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_signature_beta" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "enabled" INTEGER NOT NULL DEFAULT 0,
  "admin_note" TEXT,
  "granted_by_id" INTEGER,
  "granted_by_name" TEXT,
  "granted_by_email" TEXT,
  "granted_at" DATETIME,
  "revoked_at" DATETIME,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_signatures" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "template_id" TEXT NOT NULL DEFAULT 'corp-h-light',
  "name" TEXT,
  "job_title" TEXT,
  "company" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "profile_url" TEXT,
  "photo_url" TEXT,
  "logo_url" TEXT,
  "social_links" TEXT DEFAULT '[]',
  "show_name" INTEGER DEFAULT 1,
  "show_job_title" INTEGER DEFAULT 1,
  "show_company" INTEGER DEFAULT 1,
  "show_phone" INTEGER DEFAULT 1,
  "show_email" INTEGER DEFAULT 1,
  "show_website" INTEGER DEFAULT 1,
  "show_qr" INTEGER DEFAULT 1,
  "show_social" INTEGER DEFAULT 1,
  "show_photo" INTEGER DEFAULT 1,
  "show_logo" INTEGER DEFAULT 0,
  "accent_color" TEXT DEFAULT '#3B82F6',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "signature_by" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "feature_interest_registrations" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "feature_id" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("feature_id") REFERENCES "platform_features" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "feature_plan_rules" (
  "id" INTEGER PRIMARY KEY,
  "feature_id" INTEGER NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "access_type" TEXT NOT NULL DEFAULT 'hidden',
  FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("feature_id") REFERENCES "platform_features" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "gdpr_export_log" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "requested_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" DATETIME,
  "ip_address" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "issue_reports" (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "issue_type" TEXT NOT NULL,
  "subject" TEXT,
  "description" TEXT NOT NULL,
  "page_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "admin_notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "profile_type" TEXT,
  "reported_url" TEXT,
  "reporter_ip" TEXT,
  "reporter_ua" TEXT,
  "content_snapshot" TEXT,
  "reported_user_id" INTEGER,
  "reported_profile_id" INTEGER,
  "report_reason" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "scan_status" TEXT DEFAULT 'pending',
  "scan_risk_level" TEXT,
  "scan_summary" TEXT,
  "scan_completed_at" DATETIME,
  "scan_id" INTEGER,
  "scan_override_risk" TEXT,
  "scan_override_by" TEXT,
  "scan_override_at" DATETIME,
  "scan_reviewed" INTEGER DEFAULT 0,
  "scan_reviewed_by" TEXT,
  "scan_reviewed_at" DATETIME,
  "scan_internal_notes" TEXT
);

CREATE TABLE IF NOT EXISTS "legal_policies" (
  "id" INTEGER PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "effective_date" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "is_published" INTEGER NOT NULL DEFAULT 1,
  "last_updated" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lifetime_access_log" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "reason_category" TEXT,
  "internal_note" TEXT,
  "customer_note" TEXT,
  "granted_by" TEXT,
  "review_date" TEXT,
  "can_be_withdrawn" INTEGER DEFAULT 1,
  "fallback_plan_slug" TEXT,
  "withdrawal_reason" TEXT,
  "notify_user" INTEGER DEFAULT 0,
  "actor_id" INTEGER,
  "actor_name" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "link_clicks" (
  "id" INTEGER PRIMARY KEY,
  "link_id" INTEGER NOT NULL,
  "profile_id" INTEGER NOT NULL,
  "clicked_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "ip_hash" TEXT,
  FOREIGN KEY ("link_id") REFERENCES "profile_links" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "moderation_actions" (
  "id" INTEGER PRIMARY KEY,
  "admin_id" INTEGER,
  "admin_name" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "is_read" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "oidc_state" (
  "state" TEXT PRIMARY KEY,
  "flow" TEXT NOT NULL,
  "code_verifier" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "redirect_to" TEXT,
  "callback_uri" TEXT,
  "consumed_at" INTEGER
);

CREATE TABLE IF NOT EXISTS "page_views" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "viewed_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "ip_hash_v2" TEXT,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "partner_enquiries" (
  "id" INTEGER PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'affiliate',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT,
  "website" TEXT,
  "message" TEXT NOT NULL,
  "is_read" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "consent_given_at" DATETIME
);

CREATE TABLE IF NOT EXISTS "plans" (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "price_monthly" REAL DEFAULT 0,
  "price_yearly" REAL DEFAULT 0,
  "max_profiles" INTEGER DEFAULT 1,
  "max_links" INTEGER DEFAULT 5,
  "has_qr_download" INTEGER DEFAULT 0,
  "has_contact_form" INTEGER DEFAULT 0,
  "has_advanced_analytics" INTEGER DEFAULT 0,
  "has_vcard_download" INTEGER DEFAULT 0,
  "has_custom_themes" INTEGER DEFAULT 0,
  "remove_branding" INTEGER DEFAULT 0,
  "has_custom_domain" INTEGER DEFAULT 0,
  "is_active" INTEGER DEFAULT 1,
  "stripe_price_monthly" TEXT,
  "stripe_price_yearly" TEXT,
  "stripe_price_lifetime" TEXT,
  "has_lifetime" INTEGER DEFAULT 0,
  "stripe_product_id" TEXT,
  "has_messaging" INTEGER DEFAULT 0,
  "max_seats" INTEGER DEFAULT 1,
  "max_themes" INTEGER DEFAULT -1,
  "is_public" INTEGER DEFAULT 0,
  "has_profile_link_customisation" INTEGER DEFAULT 0,
  "max_org_profiles" INTEGER DEFAULT 0,
  "has_gallery" INTEGER DEFAULT 0,
  "has_pdf" INTEGER DEFAULT 0,
  "has_whatsapp" INTEGER DEFAULT 0,
  "has_vcard" INTEGER DEFAULT 0,
  "has_email_signature" INTEGER DEFAULT 0,
  "has_menu" INTEGER DEFAULT 0,
  "has_premium_templates" INTEGER DEFAULT 0,
  "has_seats" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "platform_features" (
  "id" INTEGER PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT DEFAULT 'addon',
  "status" TEXT NOT NULL DEFAULT 'hidden',
  "pricing_type" TEXT NOT NULL DEFAULT 'quote_required',
  "fixed_price" REAL,
  "from_price" REAL,
  "coming_soon_text" TEXT,
  "show_coming_soon" INTEGER NOT NULL DEFAULT 0,
  "show_upgrade_prompt" INTEGER NOT NULL DEFAULT 0,
  "require_admin_approval" INTEGER NOT NULL DEFAULT 0,
  "allow_register_interest" INTEGER NOT NULL DEFAULT 0,
  "dashboard_icon_visible" INTEGER NOT NULL DEFAULT 0,
  "menu_visible" INTEGER NOT NULL DEFAULT 0,
  "request_form_enabled" INTEGER NOT NULL DEFAULT 1,
  "portal_comms_enabled" INTEGER NOT NULL DEFAULT 1,
  "file_uploads_enabled" INTEGER NOT NULL DEFAULT 0,
  "proof_download_enabled" INTEGER NOT NULL DEFAULT 0,
  "final_file_enabled" INTEGER NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 99,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "points_ledger" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL DEFAULT 0,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "ref_id" INTEGER,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "points_redemptions" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "perk_key" TEXT NOT NULL,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "redeemed_at" TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "points_rules" (
  "id" INTEGER PRIMARY KEY,
  "action" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "is_active" INTEGER DEFAULT 1,
  "description" TEXT,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "points_store_items" (
  "id" INTEGER PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "cost" INTEGER NOT NULL DEFAULT 100,
  "category" TEXT NOT NULL DEFAULT 'feature',
  "icon" TEXT NOT NULL DEFAULT 'gift',
  "color" TEXT NOT NULL DEFAULT 'text-primary',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "repeatable" INTEGER NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "profile_links" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "platform" TEXT,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "icon" TEXT,
  "is_enabled" INTEGER DEFAULT 1,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "profile_scans" (
  "id" INTEGER PRIMARY KEY,
  "report_id" INTEGER,
  "profile_id" INTEGER NOT NULL,
  "profile_type" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL DEFAULT 'low',
  "risk_score" INTEGER NOT NULL DEFAULT 0,
  "issue_categories" TEXT,
  "summary" TEXT,
  "evidence" TEXT,
  "recommended_action" TEXT,
  "scan_version" TEXT DEFAULT '1.0',
  "triggered_by" TEXT DEFAULT 'auto_report',
  "auto_hidden" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("report_id") REFERENCES "issue_reports" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "display_name" TEXT,
  "job_title" TEXT,
  "company" TEXT,
  "bio" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "address" TEXT,
  "profile_photo" TEXT,
  "profile_type" TEXT DEFAULT 'personal',
  "url_prefix" TEXT DEFAULT 'F',
  "biz_slug" TEXT,
  "person_slug" TEXT,
  "theme_id" INTEGER DEFAULT 1,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "is_published" INTEGER DEFAULT 1,
  "is_verified" INTEGER DEFAULT 0,
  "verified_at" DATETIME,
  "verified_by" TEXT,
  "verification_requested_at" DATETIME,
  "verification_request_note" TEXT,
  "is_suspended" INTEGER DEFAULT 0,
  "is_hidden" INTEGER DEFAULT 0,
  "suspended_at" DATETIME,
  "suspended_by" TEXT,
  "suspension_reason" TEXT,
  "hidden_at" DATETIME,
  "hidden_by" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "profile_business_details" (
  "id" INTEGER PRIMARY KEY,
  "business_name" TEXT,
  "business_description" TEXT,
  "business_category" TEXT,
  "opening_hours" TEXT,
  "logo_url" TEXT,
  "cover_url" TEXT,
  "services" TEXT,
  "team_members" TEXT,
  "announcements" TEXT,
  "business_description_html" TEXT,
  "business_tagline" TEXT,
  "business_email" TEXT,
  "business_phone" TEXT,
  "business_website" TEXT,
  "business_address" TEXT,
  "max_seats" INTEGER DEFAULT 5,
  "business_type" TEXT DEFAULT 'other',
  "business_hours" TEXT,
  "booking_url" TEXT,
  "map_embed_url" TEXT,
  "payment_methods" TEXT,
  "featured_offer" TEXT,
  "booking_link" TEXT,
  "map_embed" TEXT,
  FOREIGN KEY ("id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "profile_public_content" (
  "id" INTEGER PRIMARY KEY,
  "bio_html" TEXT,
  "gallery" TEXT,
  "awards" TEXT,
  "faqs" TEXT,
  "certifications" TEXT,
  "testimonials" TEXT,
  "cta_buttons" TEXT,
  "headline" TEXT,
  "skills" TEXT,
  "languages" TEXT,
  "education" TEXT,
  "experience" TEXT,
  "portfolio_url" TEXT,
  "availability" TEXT,
  "pronouns" TEXT,
  "location_city" TEXT,
  "cover_image" TEXT,
  "social_channels" TEXT,
  "content_niche" TEXT,
  "speaking_topics" TEXT,
  "coaching_areas" TEXT,
  "volunteer_causes" TEXT,
  "ministry_role" TEXT,
  "publications" TEXT,
  "collab_rate" TEXT,
  "content_formats" TEXT,
  "platforms" TEXT,
  "gpa" TEXT,
  "graduation_year" TEXT,
  "internships" TEXT,
  "clubs" TEXT,
  "contact_email" TEXT,
  "social_links" TEXT,
  "menu_items" TEXT,
  "menu_title" TEXT,
  "pdf_attachments" TEXT,
  FOREIGN KEY ("id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "profile_configuration" (
  "id" INTEGER PRIMARY KEY,
  "show_phone" INTEGER DEFAULT 1,
  "show_email" INTEGER DEFAULT 1,
  "show_website" INTEGER DEFAULT 1,
  "show_address" INTEGER DEFAULT 1,
  "show_bio" INTEGER DEFAULT 1,
  "team_directory_public" INTEGER DEFAULT 1,
  "pin_hash" TEXT,
  "messaging_enabled" INTEGER DEFAULT 1,
  "enquiry_enabled" INTEGER DEFAULT 1,
  "allow_indexing" INTEGER DEFAULT 0,
  "seo_title" TEXT,
  "seo_description" TEXT,
  "public_pin_hash" TEXT,
  "public_pin_enabled" INTEGER DEFAULT 0,
  "personal_type" TEXT DEFAULT 'professional',
  "layout_preset" TEXT DEFAULT 'card',
  "colour_palette" TEXT DEFAULT 'brand',
  "custom_colour" TEXT DEFAULT '#2563eb',
  "button_style" TEXT DEFAULT 'rounded',
  "photo_shape" TEXT DEFAULT 'circle',
  "avatar_url" TEXT,
  "layout_style" TEXT,
  "design_style" TEXT,
  "color_scheme" TEXT,
  "font_style" TEXT,
  "cta_label" TEXT,
  "cta_url" TEXT,
  "show_contact_form" INTEGER DEFAULT 1,
  "show_qr_code" INTEGER DEFAULT 1,
  "plan_gated" INTEGER DEFAULT 0,
  "use_custom_editor" INTEGER DEFAULT 0,
  "whatsapp_url" TEXT,
  "whatsapp_label" TEXT,
  "whatsapp_enabled" INTEGER DEFAULT 0,
  "menu_enabled" INTEGER DEFAULT 0,
  "pdf_enabled" INTEGER DEFAULT 0,
  "gallery_enabled" INTEGER DEFAULT 0,
  "social_links_enabled" INTEGER DEFAULT 1,
  "search_directory_enabled" INTEGER DEFAULT 0,
  FOREIGN KEY ("id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "qr_codes" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "qr_data" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "referral_events" (
  "id" INTEGER PRIMARY KEY,
  "referrer_user_id" INTEGER NOT NULL,
  "referred_user_id" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "event_type" TEXT NOT NULL DEFAULT 'signup',
  "points_awarded" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("referred_user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("referrer_user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "reward_redemptions" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "reward_id" INTEGER NOT NULL,
  "points_spent" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "code" TEXT,
  "notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "fulfilled_at" DATETIME,
  FOREIGN KEY ("reward_id") REFERENCES "rewards" ("id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "rewards" (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'discount',
  "value" TEXT NOT NULL,
  "points_cost" INTEGER NOT NULL DEFAULT 0,
  "is_active" INTEGER DEFAULT 1,
  "stock" INTEGER DEFAULT -1,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session_activity" (
  "session_id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "last_active" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "fingerprint" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" TEXT PRIMARY KEY,
  "data" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_editor_content" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "html" TEXT NOT NULL DEFAULT '',
  "css" TEXT NOT NULL DEFAULT '',
  "draft_html" TEXT NOT NULL DEFAULT '',
  "draft_css" TEXT NOT NULL DEFAULT '',
  "disabled_by_admin" INTEGER NOT NULL DEFAULT 0,
  "disabled_reason" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "site_editor_content_v2" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "profile_type" TEXT NOT NULL DEFAULT 'personal',
  "html" TEXT NOT NULL DEFAULT '',
  "css" TEXT NOT NULL DEFAULT '',
  "draft_html" TEXT NOT NULL DEFAULT '',
  "draft_css" TEXT NOT NULL DEFAULT '',
  "disabled_by_admin" INTEGER NOT NULL DEFAULT 0,
  "disabled_reason" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "site_editor_versions" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "profile_type" TEXT NOT NULL DEFAULT 'personal',
  "html" TEXT NOT NULL DEFAULT '',
  "css" TEXT NOT NULL DEFAULT '',
  "published" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "stripe_config" (
  "id" INTEGER PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "status" TEXT DEFAULT 'active',
  "billing_interval" TEXT DEFAULT 'monthly',
  "stripe_subscription_id" TEXT,
  "stripe_customer_id" TEXT,
  "current_period_start" DATETIME,
  "current_period_end" DATETIME,
  "started_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "expires_at" DATETIME,
  "cancelled_at" DATETIME,
  "cancel_at_period_end" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("plan_id") REFERENCES "plans" ("id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "support_pins" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "pin" TEXT NOT NULL,
  "issued_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "expires_at" DATETIME NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "support_request_messages" (
  "id" INTEGER PRIMARY KEY,
  "ticket_id" INTEGER NOT NULL,
  "sender_type" TEXT NOT NULL,
  "sender_id" INTEGER,
  "sender_name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("ticket_id") REFERENCES "support_requests" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "support_requests" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT DEFAULT 'open',
  "priority" TEXT DEFAULT NULL,
  "category" TEXT DEFAULT NULL,
  "assigned_to" INTEGER DEFAULT NULL,
  "internal_notes" TEXT DEFAULT NULL,
  "related_profile_id" INTEGER DEFAULT NULL,
  "related_domain_id" INTEGER DEFAULT NULL,
  "resolved_at" DATETIME DEFAULT NULL,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "unread_admin" INTEGER DEFAULT 0,
  "unread_user" INTEGER DEFAULT 0,
  "consent_given_at" DATETIME,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "themes" (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "primary_color" TEXT,
  "accent_color" TEXT,
  "background_color" TEXT,
  "text_color" TEXT,
  "is_free" INTEGER DEFAULT 1,
  "is_active" INTEGER DEFAULT 1,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "category" TEXT DEFAULT 'minimal',
  "font_heading" TEXT DEFAULT 'Inter',
  "font_body" TEXT DEFAULT 'Inter',
  "card_style" TEXT DEFAULT 'rounded',
  "gradient" TEXT,
  "border_radius" TEXT DEFAULT '12px',
  "button_style" TEXT DEFAULT 'filled',
  "layout" TEXT DEFAULT 'centered',
  "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "user_achievements" (
  "id" INTEGER PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "achievement_key" TEXT NOT NULL,
  "earned" INTEGER NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "earned_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY,
  "email" TEXT NOT NULL,
  "password_hash" TEXT,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "plan_id" INTEGER DEFAULT 1,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "stripe_customer_id" TEXT,
  "lifetime_access" INTEGER DEFAULT 0,
  "lifetime_plan_id" INTEGER,
  "lifetime_granted_at" DATETIME,
  "lifetime_granted_by" TEXT,
  "lifetime_reason_category" TEXT,
  "lifetime_internal_note" TEXT,
  "lifetime_review_date" TEXT,
  "lifetime_customer_note" TEXT,
  "lifetime_can_be_withdrawn" INTEGER DEFAULT 1,
  "entra_oid" TEXT,
  "admin_entra_oid" TEXT,
  "referred_by_code" TEXT,
  "is_paused" INTEGER DEFAULT 0,
  "pause_reason" TEXT,
  "referral_consent" INTEGER DEFAULT 0,
  "referral_consent_at" TEXT,
  "last_login_at" TEXT,
  "phone" TEXT,
  "marketing_consent" INTEGER DEFAULT 0,
  "marketing_consent_at" TEXT,
  "terms_consent" INTEGER DEFAULT 0,
  "terms_consent_at" TEXT,
  "privacy_consent" INTEGER DEFAULT 0,
  "privacy_consent_at" TEXT,
  "data_improve_consent" INTEGER DEFAULT 0,
  "data_improve_consent_at" TEXT,
  "updates_consent" INTEGER DEFAULT 0,
  "updates_consent_at" TEXT,
  "crm_consent" INTEGER DEFAULT 0,
  "crm_consent_at" TEXT,
  "consent_ip" TEXT,
  "consent_version" TEXT DEFAULT '1.0',
  "trial_started_at" TEXT,
  "plan_selection_deadline" TEXT,
  "account_status" TEXT DEFAULT 'active',
  "plan_selected_at" TEXT,
  "assisted_setup_dismissed_at" TEXT,
  "assisted_setup_completed_steps" TEXT DEFAULT '[]',
  "demo_mode" INTEGER DEFAULT 0,
  "demo_mode_activated_at" TEXT,
  "legal_reaccepted_at" TEXT,
  "legal_reaccept_version" TEXT DEFAULT '1.0',
  "entra_sync_failed" INTEGER DEFAULT 0,
  "entra_sync_failed_at" TEXT,
  "entra_sync_error" TEXT,
  "is_blocked" INTEGER DEFAULT 0,
  "block_reason" TEXT,
  "blocked_at" TEXT,
  "assisted_setup_state" TEXT DEFAULT '[]',
  "payment_grace_until" TEXT,
  "user_number" TEXT,
  "preferences" TEXT DEFAULT NULL,
  "email_notification_prefs" TEXT DEFAULT NULL,
  "appearance_preference" TEXT DEFAULT 'dark'
);

CREATE TABLE IF NOT EXISTS "vat_settings" (
  "id" INTEGER PRIMARY KEY,
  "vat_enabled" INTEGER NOT NULL DEFAULT 0,
  "vat_number" TEXT,
  "vat_rate" REAL DEFAULT 20.0,
  "vat_wording_invoice" TEXT DEFAULT 'VAT',
  "vat_wording_quote" TEXT DEFAULT 'VAT',
  "vat_shown_separately" INTEGER NOT NULL DEFAULT 1,
  "vat_applies_to_delivery" INTEGER NOT NULL DEFAULT 0,
  "vat_applies_to_design_fee" INTEGER NOT NULL DEFAULT 0,
  "vat_invoice_notes" TEXT,
  "vat_enabled_at" DATETIME,
  "vat_enabled_by_admin_id" INTEGER,
  "vat_enabled_by_admin_name" TEXT,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("vat_enabled_by_admin_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "visitor_reports" (
  "id" INTEGER PRIMARY KEY,
  "profile_id" INTEGER,
  "reported_user_id" INTEGER,
  "category" TEXT NOT NULL DEFAULT 'other',
  "details" TEXT,
  "reporter_name" TEXT,
  "reporter_email" TEXT,
  "good_faith_confirmed" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'new',
  "admin_notes" TEXT,
  "action_taken" TEXT,
  "outcome" TEXT,
  "assigned_to" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("reported_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_account_closure_requests_status_created_at" ON "account_closure_requests" ("status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_closure_requests_user_id" ON "account_closure_requests" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_addons_slug" ON "addons" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_admin_settings_key" ON "admin_settings" ("key");

CREATE INDEX IF NOT EXISTS "idx_admin_user_notes_user_id_created_at" ON "admin_user_notes" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_affiliate_applications_affiliate_code" ON "affiliate_applications" ("affiliate_code");

CREATE INDEX IF NOT EXISTS "idx_affiliate_applications_user_id" ON "affiliate_applications" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_affiliate_applications_affiliate_code" ON "affiliate_applications" ("affiliate_code");

CREATE INDEX IF NOT EXISTS "idx_affiliate_commissions_affiliate_id" ON "affiliate_commissions" ("affiliate_id");

CREATE INDEX IF NOT EXISTS "idx_blocked_ips_ip_address" ON "blocked_ips" ("ip_address");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_blocked_ips_ip_address" ON "blocked_ips" ("ip_address");

CREATE INDEX IF NOT EXISTS "idx_business_card_messages_order_id_created_at" ON "business_card_messages" ("order_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_business_card_orders_status_created_at" ON "business_card_orders" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "idx_business_card_orders_user_id_created_at" ON "business_card_orders" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_business_seat_invites_email_status" ON "business_seat_invites" ("email", "status");

CREATE INDEX IF NOT EXISTS "idx_business_seat_invites_token" ON "business_seat_invites" ("token");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_business_seat_invites_token" ON "business_seat_invites" ("token");

CREATE INDEX IF NOT EXISTS "idx_business_seats_profile_id" ON "business_seats" ("profile_id");

CREATE INDEX IF NOT EXISTS "idx_card_message_threads_profile_id" ON "card_message_threads" ("profile_id");

CREATE INDEX IF NOT EXISTS "idx_card_messages_thread_id" ON "card_messages" ("thread_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_card_templates_slug" ON "card_templates" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_complaints_reference" ON "complaints" ("reference");

CREATE INDEX IF NOT EXISTS "idx_custom_domains_user_id" ON "custom_domains" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_custom_domains_domain" ON "custom_domains" ("domain");

CREATE INDEX IF NOT EXISTS "idx_customer_addons_user_id" ON "customer_addons" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_addons_user_id_addon_id" ON "customer_addons" ("user_id", "addon_id");

CREATE INDEX IF NOT EXISTS "idx_customer_feature_overrides_user_id" ON "customer_feature_overrides" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_feature_overrides_user_id_feature_id" ON "customer_feature_overrides" ("user_id", "feature_id");

CREATE INDEX IF NOT EXISTS "idx_data_requests_status_created_at" ON "data_requests" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "idx_data_requests_user_id_created_at" ON "data_requests" ("user_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_signature_beta_user_id" ON "email_signature_beta" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_signatures_user_id" ON "email_signatures" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_email_signatures_user_id" ON "email_signatures" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_signatures_user_id" ON "email_signatures" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_feature_interest_registrations_user_id_feature_id" ON "feature_interest_registrations" ("user_id", "feature_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_feature_plan_rules_feature_id_plan_id" ON "feature_plan_rules" ("feature_id", "plan_id");

CREATE INDEX IF NOT EXISTS "idx_gdpr_export_log_user_id_requested_at" ON "gdpr_export_log" ("user_id", "requested_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_legal_policies_key" ON "legal_policies" ("key");

CREATE INDEX IF NOT EXISTS "idx_moderation_actions_admin_id" ON "moderation_actions" ("admin_id");

CREATE INDEX IF NOT EXISTS "idx_notifications_user_id_is_read_created_at" ON "notifications" ("user_id", "is_read", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_plans_slug" ON "plans" ("slug");

CREATE INDEX IF NOT EXISTS "idx_platform_features_status" ON "platform_features" ("status");

CREATE INDEX IF NOT EXISTS "idx_platform_features_slug" ON "platform_features" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_platform_features_slug" ON "platform_features" ("slug");

CREATE INDEX IF NOT EXISTS "idx_points_ledger_user_id_created_at" ON "points_ledger" ("user_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_points_rules_action" ON "points_rules" ("action");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_points_store_items_key" ON "points_store_items" ("key");

CREATE INDEX IF NOT EXISTS "idx_profile_scans_risk_level" ON "profile_scans" ("risk_level");

CREATE INDEX IF NOT EXISTS "idx_profile_scans_report_id" ON "profile_scans" ("report_id");

CREATE INDEX IF NOT EXISTS "idx_profile_scans_profile_id" ON "profile_scans" ("profile_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_profiles_biz_slug_person_slug" ON "profiles" ("biz_slug", "person_slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_profiles_username" ON "profiles" ("username");

CREATE INDEX IF NOT EXISTS "idx_referral_codes_user_id" ON "referral_codes" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_referral_codes_code" ON "referral_codes" ("code");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_referral_codes_user_id" ON "referral_codes" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_referral_events_referrer_user_id" ON "referral_events" ("referrer_user_id");

CREATE INDEX IF NOT EXISTS "idx_reward_redemptions_user_id_created_at" ON "reward_redemptions" ("user_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_site_editor_content_user_id" ON "site_editor_content" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_site_editor_content_v2_user_id_profile_type" ON "site_editor_content_v2" ("user_id", "profile_type");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_stripe_config_key" ON "stripe_config" ("key");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_support_pins_user_id" ON "support_pins" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_support_request_messages_ticket_id" ON "support_request_messages" ("ticket_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_themes_slug" ON "themes" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_achievements_user_id_achievement_key" ON "user_achievements" ("user_id", "achievement_key");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_user_number" ON "users" ("user_number");

CREATE INDEX IF NOT EXISTS "idx_users_entra_oid" ON "users" ("entra_oid");
CREATE INDEX IF NOT EXISTS "idx_users_admin_entra_oid" ON "users" ("admin_entra_oid");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
