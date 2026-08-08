import { HttpError } from "./http.js";

const API_BASE = "https://api.cloudflare.com/client/v4";

function cleanConfigValue(value) {
  return String(value ?? "").trim();
}

export function cloudflareSaasConfig(env) {
  const token = cleanConfigValue(env.CLOUDFLARE_SAAS_API_TOKEN);
  const zoneId = cleanConfigValue(env.CLOUDFLARE_SAAS_ZONE_ID);
  const cnameTarget = cleanConfigValue(env.CLOUDFLARE_SAAS_CNAME_TARGET).toLowerCase().replace(/\.$/, "");

  if (!token || !zoneId || !cnameTarget) {
    throw new HttpError(
      503,
      "Custom domains are not fully configured yet. Contact support if this continues.",
      "custom_domains_not_configured",
    );
  }
  if (!/^[a-z0-9.-]+$/i.test(cnameTarget) || !cnameTarget.includes(".")) {
    throw new HttpError(503, "The custom-domain CNAME target is invalid.", "custom_domain_target_invalid");
  }
  return { token, zoneId, cnameTarget };
}

async function cfRequest(env, path, { method = "GET", body, allow404 = false } = {}) {
  const config = cloudflareSaasConfig(env);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (allow404 && response.status === 404) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.map((error) => error?.message).filter(Boolean).join("; ")
      || `Cloudflare request failed with HTTP ${response.status}.`;
    const error = new HttpError(502, `Cloudflare could not complete the custom-domain request: ${message}`, "cloudflare_saas_error");
    error.cloudflareStatus = response.status;
    throw error;
  }

  return payload?.result ?? payload;
}

export function hostnameSnapshot(result, env) {
  const config = cloudflareSaasConfig(env);
  const validationRecords = Array.isArray(result?.ssl?.validation_records)
    ? result.ssl.validation_records
    : [];
  const validationErrors = Array.isArray(result?.ssl?.validation_errors)
    ? result.ssl.validation_errors.map((item) => item?.message).filter(Boolean)
    : [];

  return {
    cloudflare_hostname_id: result?.id ?? null,
    hostname_status: result?.status ?? "pending",
    ssl_status: result?.ssl?.status ?? "pending",
    cname_target: config.cnameTarget,
    ownership_verification: result?.ownership_verification ?? null,
    ssl_validation: validationRecords,
    validation_errors: validationErrors,
    ready: result?.status === "active" && result?.ssl?.status === "active",
  };
}

export async function createCustomHostname(env, hostname) {
  const config = cloudflareSaasConfig(env);
  const result = await cfRequest(env, `/zones/${encodeURIComponent(config.zoneId)}/custom_hostnames`, {
    method: "POST",
    body: {
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2",
          http2: "on",
          tls_1_3: "on",
        },
      },
    },
  });
  return hostnameSnapshot(result, env);
}

export async function getCustomHostname(env, hostnameId) {
  const config = cloudflareSaasConfig(env);
  const result = await cfRequest(
    env,
    `/zones/${encodeURIComponent(config.zoneId)}/custom_hostnames/${encodeURIComponent(hostnameId)}`,
  );
  return hostnameSnapshot(result, env);
}

export async function restartCustomHostnameValidation(env, hostnameId) {
  const config = cloudflareSaasConfig(env);
  const result = await cfRequest(
    env,
    `/zones/${encodeURIComponent(config.zoneId)}/custom_hostnames/${encodeURIComponent(hostnameId)}`,
    {
      method: "PATCH",
      body: {
        ssl: {
          method: "http",
          type: "dv",
          settings: {
            min_tls_version: "1.2",
            http2: "on",
            tls_1_3: "on",
          },
        },
      },
    },
  );
  return hostnameSnapshot(result, env);
}

export async function deleteCustomHostname(env, hostnameId) {
  if (!hostnameId) return;
  const config = cloudflareSaasConfig(env);
  await cfRequest(
    env,
    `/zones/${encodeURIComponent(config.zoneId)}/custom_hostnames/${encodeURIComponent(hostnameId)}`,
    { method: "DELETE", allow404: true },
  );
}
