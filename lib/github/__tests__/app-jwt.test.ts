import { describe, expect, it } from "vitest";

import {
  normalizeGithubAppPrivateKey,
} from "@/lib/github/app-jwt";

describe("normalizeGithubAppPrivateKey", () => {
  const pkcs8Pem =
    "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----";

  it("unescapes \\n in PEM", () => {
    const raw = pkcs8Pem.replace(/\n/g, "\\n");
    expect(normalizeGithubAppPrivateKey(raw)).toContain("BEGIN PRIVATE KEY");
    expect(normalizeGithubAppPrivateKey(raw)).not.toContain("\\n");
  });

  it("decodes base64-wrapped PEM", () => {
    const b64 = Buffer.from(pkcs8Pem, "utf8").toString("base64");
    expect(normalizeGithubAppPrivateKey(b64)).toContain("BEGIN PRIVATE KEY");
  });

  it("throws on invalid base64 without PEM markers", () => {
    expect(() => normalizeGithubAppPrivateKey(Buffer.from("nope").toString("base64"))).toThrow(
      /PEM/,
    );
  });
});
