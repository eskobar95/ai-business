import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubRevokeInstallationAccessToken } from "@/lib/github/rest";

describe("githubRevokeInstallationAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /installation/token and treats 204 as OK", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await expect(githubRevokeInstallationAccessToken("test-token")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/installation/token",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("calls DELETE /installation/token and treats 404 as OK", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    await expect(githubRevokeInstallationAccessToken("test-token")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/installation/token",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on unexpected HTTP status from revoke", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("too many requests", { status: 429 }),
    );
    await expect(githubRevokeInstallationAccessToken("test-token")).rejects.toThrow(
      /GitHub revoke installation token failed: 429/,
    );
  });
});
