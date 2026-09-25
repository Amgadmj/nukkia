#!/usr/bin/env node
// Read-only. Offline by default. --remote permits only three zero-row GETs;
// never calls quota RPCs, AI providers, auth/session endpoints, or migrations.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function publicHeaders(key) {
  if (key?.startsWith("sb_publishable_")) return { apikey: key };
  try {
    const role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    if (role === "anon") return { apikey: key, Authorization: `Bearer ${key}` };
  } catch {
    /* Reject unknown/elevated credentials without displaying them. */
  }
  return null;
}

export async function checkDemoReadiness({
  env = {},
  remote = false,
  ffmpegAvailable = false,
  fetchImpl = fetch,
} = {}) {
  const checks = [];
  const add = (name, status, code, httpStatus) =>
    checks.push({ name, status, ...(code ? { code } : {}), ...(httpStatus ? { httpStatus } : {}) });
  for (const name of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ])
    add(name, env[name]?.trim() ? "pass" : "fail", env[name]?.trim() ? "present" : "missing");
  add(
    "deployment_preset",
    env.NITRO_PRESET === "node-server" ? "pass" : "fail",
    "requires_node_server",
  );
  let target;
  try {
    target = new URL(env.SUPABASE_URL);
    const browser = new URL(env.VITE_SUPABASE_URL);
    if (
      target.protocol !== "https:" ||
      !target.hostname.endsWith(".supabase.co") ||
      target.username ||
      target.password ||
      target.search ||
      target.hash ||
      target.pathname !== "/"
    )
      throw new Error();
    if (target.href !== browser.href) throw new Error();
    add("supabase_target", "pass", "browser_server_match");
  } catch {
    add("supabase_target", "fail", "invalid_or_mismatched_target");
  }
  const headers = publicHeaders(env.SUPABASE_PUBLISHABLE_KEY);
  const browserHeaders = publicHeaders(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  add(
    "public_credentials",
    headers && browserHeaders ? "pass" : "fail",
    headers && browserHeaders ? "public_only" : "invalid_or_elevated_not_used",
  );
  const canProbe = !checks.some((check) => check.status === "fail");
  add(
    "ffmpeg",
    ffmpegAvailable ? "pass" : "fail",
    ffmpegAvailable ? "executable_available" : "executable_unavailable",
  );
  for (const name of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"])
    add(
      name,
      env[name]?.trim() ? "pass" : "warn",
      env[name]?.trim() ? "present_not_provider_verified" : "missing_provider_disabled",
    );
  add("signed_in_rls_and_save", "skip", "requires_partner_smoke_test");
  add("private_storage_buckets", "skip", "partner_verify_brand_assets_and_content_media");
  if (!remote || !canProbe)
    add("remote_tables", "skip", remote ? "unsafe_configuration" : "use_remote_flag_to_opt_in");
  else
    await Promise.all(
      ["marketing_workspaces", "brand_stories", "onboarding_drafts"].map(async (table) => {
        try {
          const url = new URL(`/rest/v1/${table}?select=company_id&limit=0`, target);
          const response = await fetchImpl(url, {
            method: "GET",
            headers: { ...headers, "Accept-Profile": "public" },
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            const body = await response.json();
            add(
              table,
              Array.isArray(body) && body.length === 0 ? "pass" : "fail",
              Array.isArray(body) && body.length === 0
                ? "exposed_zero_rows"
                : "unexpected_response",
              response.status,
            );
            return;
          }
          const body = await response.json().catch(() => null);
          const code =
            typeof body?.code === "string" && /^(PGRST\d{3}|[A-Z0-9]{5})$/.test(body.code)
              ? body.code
              : "unclassified";
          // These tables revoke anon SELECT. 42501 proves table exposure, not RLS
          // correctness or authenticated read/write access.
          add(
            table,
            code === "42501" ? "warn" : "fail",
            code === "42501" ? "exposed_access_restricted" : code,
            response.status,
          );
        } catch {
          add(table, "fail", "request_unavailable");
        }
      }),
    );
  return {
    ok: !checks.some((check) => check.status === "fail"),
    scope: "configuration_and_optional_schema_exposure_only",
    checks,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--remote")) throw new Error();
  let local = {};
  try {
    local = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error();
  }
  const env = { ...local, ...process.env };
  const ffmpeg = spawnSync(env.FFMPEG_PATH || "ffmpeg", ["-version"], {
    timeout: 5000,
    stdio: "ignore",
  });
  const result = await checkDemoReadiness({
    env,
    remote: args.includes("--remote"),
    ffmpegAvailable: ffmpeg.status === 0,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Readiness check unavailable: check arguments, Node runtime and environment file. No configuration values were printed.",
    );
    process.exitCode = 1;
  });
