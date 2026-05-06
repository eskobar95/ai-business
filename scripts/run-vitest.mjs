#!/usr/bin/env node
/**
 * Delegates Vitest to another checkout when needed: on some Windows setups, running
 * Vitest with cwd = a secondary git worktree registers zero tests while the same
 * tree works when launched with `-r <worktree>` from the primary `ai-business` clone.
 * CI (single checkout) falls through to normal Vitest here.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userArgs = process.argv.slice(2);

const vitestRel = path.join("node_modules", "vitest", "vitest.mjs");
const primaryFromEnv = process.env.AI_BUSINESS_PRIMARY_ROOT?.trim();
const defaultPrimary = path.join(projectRoot, "..", "ai-business");
const primaryCandidate = primaryFromEnv
  ? path.resolve(projectRoot, primaryFromEnv)
  : defaultPrimary;

const projectVitest = path.join(projectRoot, vitestRel);
const primaryVitest = path.join(primaryCandidate, vitestRel);

function normalize(p) {
  return path.resolve(p);
}

function vitestBinaryForPrimaryLaunch() {
  if (existsSync(primaryVitest)) return primaryVitest;
  if (existsSync(projectVitest)) return projectVitest;
  return null;
}

function shouldDelegateToPrimary() {
  if (!existsSync(primaryVitest)) return false;
  if (!existsSync(path.join(primaryCandidate, "package.json"))) return false;
  return normalize(primaryCandidate) !== normalize(projectRoot);
}

const node = process.execPath;

if (shouldDelegateToPrimary()) {
  const bin = vitestBinaryForPrimaryLaunch();
  if (!bin) {
    console.error("run-vitest: vitest not found under project or primary checkout");
    process.exit(1);
  }
  const r = spawnSync(
    node,
    [bin, "-r", projectRoot, ...userArgs],
    { stdio: "inherit", cwd: primaryCandidate },
  );
  process.exit(r.status ?? 1);
}

if (!existsSync(projectVitest)) {
  console.error("run-vitest: vitest is not installed (missing node_modules/vitest)");
  process.exit(1);
}

const r = spawnSync(node, [projectVitest, ...userArgs], {
  stdio: "inherit",
  cwd: projectRoot,
});
process.exit(r.status ?? 1);
