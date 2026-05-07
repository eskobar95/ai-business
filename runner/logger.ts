/**
 * Stderr/stdout for the standalone runner CLI. Consolidates `no-console` in one module so call
 * sites stay clean and we can swap to structured logging later without touching poll/dispatch.
 */
/* eslint-disable no-console -- operator-facing CLI process has no Next.js / pino wiring */

export function runnerLogInfo(...args: unknown[]): void {
  console.info(...args);
}

/** Alias for info-level operator logs with a scope prefix (matches `runnerLogError` shape). */
export function runnerLog(scope: string, ...args: unknown[]): void {
  console.info(`[${scope}]`, ...args);
}

export function runnerLogError(scope: string, ...args: unknown[]): void {
  console.error(`[${scope}]`, ...args);
}
