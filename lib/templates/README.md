# Template utilities (`lib/templates`)

Enterprise template **validation**, **bundle verification**, and **database seeding** helpers used by:

- `npm run templates:build` → [`scripts/templates/build.ts`](../../scripts/templates/build.ts)
- `npm run templates:seed-org` → [`scripts/templates/seed-org.ts`](../../scripts/templates/seed-org.ts)

| File | Purpose |
|------|---------|
| [`canonical-json.ts`](./canonical-json.ts) | Deterministic JSON serialization for shard hashing |
| [`zod-schemas.ts`](./zod-schemas.ts) | Zod schemas for each JSON shard + full bundle payload |
| [`bundle-verify.ts`](./bundle-verify.ts) | `verifyAndParseBundle()` — schema + SHA-256 checks |
| [`template-errors.ts`](./template-errors.ts) | `TemplateSeedError` with `TEMPLATE_HASH_MISMATCH`, `BUNDLE_SCHEMA_INVALID`, `SEED_REFERENCE_MISSING`, `BUSINESS_NOT_FOUND` |
| [`seed-enterprise-template.ts`](./seed-enterprise-template.ts) | Idempotent Drizzle upserts into `agents`, `teams`, `team_members`, `gate_kinds`, `communication_edges`, `agent_documents`, sets business lineage + `template_seeded`, returns counts |
| [`seed-action.ts`](./seed-action.ts) | `seedEnterpriseTemplateAction` Server Action for dashboard one-click seed |
| [`get-template-preview.ts`](./get-template-preview.ts) | Loads built bundle from disk and returns static preview payload for the UI |
| [`db-types.ts`](./db-types.ts) | `AppDb` alias (`ReturnType<typeof getDb>`) |
| [`error-registry.ts`](./error-registry.ts) | Typesafe `getError(code)` over [`templates/conduro/enterprise/v3/errors/registry.json`](../../templates/conduro/enterprise/v3/errors/registry.json) |

## Usage

```ts
import { verifyAndParseBundle } from "@/lib/templates/bundle-verify";
import { seedEnterpriseTemplate } from "@/lib/templates/seed-enterprise-template";
import { getDb } from "@/db/index";

const bundle = verifyAndParseBundle(JSON.parse(fs.readFileSync("dist/conduro.enterprise.3.0.0.bundle.json", "utf8")));
await seedEnterpriseTemplate(getDb(), businessId, bundle);
```

## Typecheck vs production build

`npm run typecheck` uses [`tsconfig.typecheck.json`](../../tsconfig.typecheck.json) (no `.next/` dependency) for a fast CLI pass. Shipping still requires **`npm run build`**, which applies Next.js routing/types checks against generated `.next/types`.

Seeding uses **one multi-row `insert().values([...]).onConflictDoUpdate`** per target table to reduce round-trips to Postgres (Neon). The Neon **HTTP** driver does not implement `db.transaction()`; lineage fields on `businesses` are written **after** all upserts so failed runs do not flip template metadata early. The final update also sets **`template_seeded = true`**. **`agents.role`** is filled from shard **`role_summary`** (human-readable); stable keys remain in **`agents.slug`**.
