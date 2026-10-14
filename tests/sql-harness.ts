/**
 * An in-process Postgres (PGlite) that applies every migration in order, with
 * the minimum Supabase stubs: the auth schema and `auth.uid()`, the three API
 * roles and a storage schema. It lets tests exercise the real SQL, RLS
 * policies and SECURITY DEFINER functions without a database server.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

export type Harness = {
  db: PGlite;
  /** Run as a signed-in user (RLS applies). */
  as: (uid: string, sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Run as the service role (bypasses RLS). */
  service: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Run as an anonymous visitor. */
  anon: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
};

let shared: Promise<Harness> | undefined;

/** Boots once per test file (about five seconds) and clears all data on every call after the first. */
export function bootDatabase(): Promise<Harness> {
  shared ??= createDatabase();
  return shared.then(async (h) => {
    await h.db.exec(`
      TRUNCATE auth.users, public.price_registry, public.ai_usage, public.billing_events, public.video_unit_events CASCADE;
      UPDATE public.pricing_assumptions SET fx_brl_per_usd = 5.2 WHERE id = 1;
    `);
    return h;
  });
}

async function createDatabase(): Promise<Harness> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, allowed_mime_types text[], file_size_limit bigint);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array(name,'/') $$;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }

  async function run(role: string, uid: string, sql: string, params?: unknown[]) {
    await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${uid}', false)`);
    try {
      return (await db.query(sql, params)).rows as Record<string, unknown>[];
    } finally {
      await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false)`);
    }
  }
  return {
    db,
    as: (uid, sql, params) => run("authenticated", uid, sql, params),
    service: (sql, params) => run("service_role", "", sql, params),
    anon: (sql, params) => run("anon", "", sql, params),
  };
}

/** Asserts that a query is rejected and that the error text matches. */
export async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message))
      throw new Error(`Rejected, but with "${message}" instead of ${pattern}`);
    return;
  }
  throw new Error(`Expected a rejection matching ${pattern}`);
}
