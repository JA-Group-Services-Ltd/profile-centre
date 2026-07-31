import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";

const ORDER_FIELDS = [
  "profile_id", "quantity", "finish", "sides", "name", "role", "phone", "email",
  "website", "logo_url", "brand_colour", "notes", "request_type", "template_id",
  "card_type", "card_size", "corner_type", "customer_notes", "has_own_design",
  "delivery_address", "business_name_on_card",
];
const DESIGN_FIELDS = [
  "attached_image_url", "card_color", "card_accent", "card_layout", "name_on_card",
  "role_on_card", "phone_on_card", "email_on_card", "website_on_card",
  "tagline_on_card", "upload_urls", "template_data", "qr_code_url",
  "front_bg_color", "front_text_color", "front_accent_color", "font_choice",
  "brand_colors", "style_preference", "address_on_card", "social_links",
  "front_back_preference", "qr_required", "upload_front_url", "upload_back_url",
  "upload_file_type",
];

function serialise(value) {
  if (typeof value === "boolean") return Number(value);
  if (value != null && typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

function selected(body, fields) {
  return fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
}

function joinedSelect(where) {
  return `
    SELECT o.*, d.*, f.*,
      o.id AS id, o.user_id AS user_id, o.status AS status,
      o.created_at AS created_at, o.updated_at AS updated_at
    FROM business_card_orders o
    LEFT JOIN business_card_order_design d ON d.id = o.id
    LEFT JOIN business_card_order_financials f ON f.id = o.id
    ${where}
  `;
}

function publicOrder(row) {
  if (!row) return row;
  delete row.internal_notes;
  delete row.provider_cost;
  delete row.delivery_cost;
  delete row.handling_fee;
  delete row.stripe_payment_notes;
  return row;
}

export async function businessCardsEnabled(database) {
  const row = await database.prepare(
    "SELECT value FROM admin_settings WHERE key = 'business_cards_enabled' LIMIT 1",
  ).first();
  return String(row?.value ?? "0") === "1";
}

export async function myBusinessCardOrders(database, user) {
  if (!await businessCardsEnabled(database)) {
    throw new HttpError(403, "Business cards are not currently available.", "feature_disabled");
  }
  const result = await database.prepare(
    `${joinedSelect("WHERE o.user_id = ?1")} ORDER BY o.created_at DESC, o.id DESC`,
  ).bind(user.id).all();
  return { success: true, orders: result.results.map(publicOrder), data: result.results.map(publicOrder) };
}

export async function createBusinessCardOrder(request, database, user) {
  if (!await businessCardsEnabled(database)) {
    throw new HttpError(403, "Business cards are not currently available.", "feature_disabled");
  }
  const body = await readJson(request);
  const orderFields = selected(body, ORDER_FIELDS);
  const orderColumns = ["user_id", "status", ...orderFields];
  const orderValues = [user.id, "submitted", ...orderFields.map((field) => serialise(body[field]))];
  const order = await database.prepare(`
    INSERT INTO business_card_orders (${orderColumns.map((field) => `"${field}"`).join(", ")})
    VALUES (${orderValues.map((_, index) => `?${index + 1}`).join(", ")}) RETURNING id
  `).bind(...orderValues).first();
  const designFields = selected(body, DESIGN_FIELDS);
  try {
    await database.batch([
      database.prepare(`
        INSERT INTO business_card_order_design
          (id${designFields.length ? `, ${designFields.map((field) => `"${field}"`).join(", ")}` : ""})
        VALUES (?1${designFields.map((_, index) => `, ?${index + 2}`).join("")})
      `).bind(order.id, ...designFields.map((field) => serialise(body[field]))),
      database.prepare("INSERT INTO business_card_order_financials (id) VALUES (?1)").bind(order.id),
    ]);
  } catch (error) {
    await database.prepare("DELETE FROM business_card_orders WHERE id = ?1 AND user_id = ?2")
      .bind(order.id, user.id).run();
    throw error;
  }
  await writeAudit(database, request, user, "business_card_requested", "business_card_order",
    `Created business card request ${order.id}`);
  const created = await database.prepare(`${joinedSelect("WHERE o.id = ?1 AND o.user_id = ?2")} LIMIT 1`)
    .bind(order.id, user.id).first();
  return { success: true, order: publicOrder(created), data: publicOrder(created) };
}
