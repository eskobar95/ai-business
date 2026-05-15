import { config } from "dotenv";
import { resolve } from "node:path";

/** Match Drizzle CLI: `.env` then `.env.local` overrides. */
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

/**
 * Apply Drizzle migrations using a TCP Postgres driver.
 *
 * drizzle-kit migrate uses @neondatabase/serverless in drizzle.config.ts, which
 * relies on WebSockets and often fails or exits non‑zero in CI when applying
 * sequential DDL. The app runtime still uses Neon HTTP/serverless via getDb().
 *
 * Env: by default tries DATABASE_DIRECT_URL first, then DATABASE_URL. Invalid /
 * placeholder secrets (common when DATABASE_DIRECT_URL exists but is
 * misconfigured) are skipped so a valid pooled DATABASE_URL can still run
 * migrations.
 *
 * In CI (`CI=true`), DATABASE_URL is tried first so migrations hit the same
 * database as `getDb()` (Neon HTTP). If DATABASE_DIRECT_URL pointed at a
 * different DB, the app would 500 on missing columns while migrate appeared to
 * succeed. Set MIGRATE_PREFER_DIRECT_URL=true to restore direct-first order.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

function pickMigrateUrl() {
  const direct = process.env.DATABASE_DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();

  const preferPooledInCi =
    process.env.CI === "true" &&
    process.env.MIGRATE_PREFER_DIRECT_URL !== "true";

  const candidates = preferPooledInCi
    ? [pooled, direct]
    : [direct, pooled];

  for (const raw of candidates.filter(Boolean)) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
        continue;
      }
      return raw;
    } catch {
      /* invalid URL — try next candidate */
    }
  }
  return null;
}

const url = pickMigrateUrl();

if (!url) {
  console.error(
    "run-drizzle-migrate: need a valid postgres:// or postgresql:// URL in DATABASE_URL or DATABASE_DIRECT_URL.",
  );
  process.exit(1);
}

try {
  const { hostname } = new URL(url);
  const orderNote =
    process.env.CI === "true"
      ? process.env.MIGRATE_PREFER_DIRECT_URL === "true"
        ? "direct-first (MIGRATE_PREFER_DIRECT_URL)"
        : "pooled-first (same default DB as Next.js DATABASE_URL)"
      : "local default (direct URL first when set)";
  console.log(`run-drizzle-migrate: host=${hostname} (${orderNote})`);
} catch {
  /* ignore */
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} finally {
  await sql.end({ timeout: 10 });
}
