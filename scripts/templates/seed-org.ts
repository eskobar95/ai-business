import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

import { getDb } from "@/db/index";
import { verifyAndParseBundle } from "@/lib/templates/bundle-verify";
import { seedEnterpriseTemplate } from "@/lib/templates/seed-enterprise-template";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function parseArgs(): { orgId: string; bundlePath: string } {
  const argv = process.argv.slice(2);
  let orgId = "";
  let bundlePath = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--org-id") orgId = argv[++i] ?? "";
    else if (a === "--bundle") bundlePath = argv[++i] ?? "";
  }
  if (!orgId) {
    console.error("Usage: npm run templates:seed-org -- --org-id <uuid> [--bundle path/to/conduro.enterprise.3.0.0.bundle.json]");
    process.exit(1);
  }
  const uuidParse = z.uuid().safeParse(orgId);
  if (!uuidParse.success) {
    console.error("Invalid --org-id: expected a UUID string");
    process.exit(1);
  }
  if (!bundlePath) {
    bundlePath = resolve(process.cwd(), "dist", "conduro.enterprise.3.0.0.bundle.json");
  }
  return { orgId, bundlePath };
}

async function run(): Promise<void> {
  const { orgId, bundlePath } = parseArgs();
  const raw = JSON.parse(readFileSync(bundlePath, "utf8"));
  const bundle = verifyAndParseBundle(raw);
  const db = getDb();
  const summary = await seedEnterpriseTemplate(db, orgId, bundle);
  console.log(`Seeded organization ${orgId} from ${bundlePath}`, summary);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
