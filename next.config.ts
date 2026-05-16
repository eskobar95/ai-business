import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

/** Prefer this worktree lockfile when multiple package-lock.json files exist (nested worktrees). */
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  /** Ensure template JSON is present in standalone/serverless output (merge_smart reads policy.json). */
  outputFileTracingIncludes: {
    "/api/**": ["./templates/conduro/enterprise/v3/**/*.json"],
    "/dashboard/**": ["./templates/conduro/enterprise/v3/**/*.json"],
  },
  /** Prevent bundling Cursor SDK (dynamic graph pulls .d.ts.map into webpack). */
  serverExternalPackages: ["@cursor/sdk"],
  /** Transpile @streamdown/code so Next.js bundles its own shiki 3.x rather than
   *  trying to externalize it against the project-level shiki 4.x. */
  transpilePackages: ["@streamdown/code"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
