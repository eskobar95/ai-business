import { afterEach, describe, expect, it } from "vitest";

import {
  encodeGithubInstallBusinessCookie,
  verifyGithubInstallBusinessCookie,
} from "@/lib/github/pending-install-cookie";

const testKeyHex = "0123456789abcdef".repeat(4);

describe("github pending install cookie", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("round-trips signed business binding", () => {
    process.env.ENCRYPTION_KEY = testKeyHex;
    const jar = encodeGithubInstallBusinessCookie("11111111-1111-1111-1111-111111111111");
    expect(verifyGithubInstallBusinessCookie(jar)).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejects invalid signatures", () => {
    process.env.ENCRYPTION_KEY = testKeyHex;
    const jar = encodeGithubInstallBusinessCookie("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const lastDot = jar.lastIndexOf(".");
    expect(lastDot).toBeGreaterThan(0);
    const corrupted = `${jar.slice(0, lastDot + 1)}bogus`;
    expect(verifyGithubInstallBusinessCookie(corrupted)).toBeNull();
  });
});
