import { loadRunnerEnv } from "./bootstrap-env";

loadRunnerEnv();

import { runnerLogError, runnerLogInfo } from "./logger";
import { pollOnce } from "./poll";

const INTERVAL_MS = 10_000;

async function tick() {
  try {
    await pollOnce();
  } catch (e) {
    runnerLogError("runner", "poll error:", e instanceof Error ? e.message : e);
  }
}

const envFallback = !!process.env.CURSOR_API_KEY?.trim();

void tick().then(() => {
  runnerLogInfo(
    `[runner] Polling every ${INTERVAL_MS / 1000}s (Ctrl+C to stop). Workspace keys preferred; CURSOR_API_KEY fallback ${envFallback ? "enabled" : "disabled"}.`,
  );
});
setInterval(tick, INTERVAL_MS);
