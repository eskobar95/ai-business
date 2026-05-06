import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bufferedGithubWebhookBodyExceedsLimit,
  contentLengthHeaderExceedsGithubWebhookLimit,
  parseContentLengthBytes,
  resolveGithubWebhookMaxBodyBytes,
} from "../github-webhook-limits";

describe("github-webhook-limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.GITHUB_WEBHOOK_MAX_BODY_BYTES;
  });

  it("parseContentLengthBytes parses valid decimal", () => {
    expect(parseContentLengthBytes("4096")).toBe(4096);
  });

  it("parseContentLengthBytes returns null on invalid", () => {
    expect(parseContentLengthBytes("")).toBe(null);
    expect(parseContentLengthBytes("nope")).toBe(null);
    expect(parseContentLengthBytes("-1")).toBe(null);
  });

  it("resolveGithubWebhookMaxBodyBytes respects env override", () => {
    vi.stubEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "2048");
    expect(resolveGithubWebhookMaxBodyBytes()).toBe(2048);
  });

  it("resolveGithubWebhookMaxBodyBytes falls back when env is invalid", () => {
    vi.stubEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "0");
    expect(resolveGithubWebhookMaxBodyBytes()).toBeGreaterThanOrEqual(1024 * 1024);

    vi.unstubAllEnvs();
    vi.stubEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "not-a-number");
    expect(resolveGithubWebhookMaxBodyBytes()).toBeGreaterThanOrEqual(1024 * 1024);
  });

  it("detects oversized Content-Length", () => {
    vi.stubEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "100");
    expect(contentLengthHeaderExceedsGithubWebhookLimit("500")).toBe(true);
    expect(contentLengthHeaderExceedsGithubWebhookLimit("90")).toBe(false);
    expect(contentLengthHeaderExceedsGithubWebhookLimit(null)).toBe(false);
  });

  it("detects buffered body over limit", () => {
    vi.stubEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "10");
    expect(bufferedGithubWebhookBodyExceedsLimit(20)).toBe(true);
    expect(bufferedGithubWebhookBodyExceedsLimit(5)).toBe(false);
  });
});
