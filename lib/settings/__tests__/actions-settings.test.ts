import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptCredential } from "@/lib/mcp/encryption.js";

const testKeyHex = "0123456789abcdef".repeat(4);

const capture = vi.hoisted(() => ({
  lastInsert: null as null | {
    userId: string;
    cursorApiKeyEncrypted: { ciphertext: string; tag: string } | null;
    cursorApiKeyIv: string | null;
  },
}));

const verifyCursorApiKeyMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<
      | { ok: true }
      | { ok: false; reason: "invalid_credentials" | "rate_limited" | "network" | "unknown" }
    > => ({ ok: true }),
  ),
);

vi.mock("@/lib/cursor/verify-api-key", () => ({
  verifyCursorApiKey: verifyCursorApiKeyMock,
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-phase2"),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        capture.lastInsert = {
          userId: String(v.userId),
          cursorApiKeyEncrypted:
            v.cursorApiKeyEncrypted != null
              ? (v.cursorApiKeyEncrypted as { ciphertext: string; tag: string })
              : null,
          cursorApiKeyIv: typeof v.cursorApiKeyIv === "string" ? v.cursorApiKeyIv : null,
        };
        return {
          onConflictDoUpdate: () => Promise.resolve(),
        };
      },
    }),
  }),
}));

describe("saveUserSettings encryption", () => {
  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY;
    capture.lastInsert = null;
    verifyCursorApiKeyMock.mockClear();
    verifyCursorApiKeyMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    capture.lastInsert = null;
    verifyCursorApiKeyMock.mockClear();
    verifyCursorApiKeyMock.mockResolvedValue({ ok: true });
  });

  it(
    "encrypts Cursor API key and supports round-trip with ENCRYPTION_KEY",
    async () => {
      process.env.ENCRYPTION_KEY = testKeyHex;

      const { saveUserSettings } = await import("@/lib/settings/actions.js");
      await saveUserSettings("  sk-test-secret  ");

      expect(capture.lastInsert?.userId).toBe("user-phase2");
      expect(capture.lastInsert?.cursorApiKeyIv?.length ?? 0).toBeGreaterThan(8);
      expect(capture.lastInsert?.cursorApiKeyEncrypted?.ciphertext).toBeTruthy();

      const decrypted = decryptCredential(capture.lastInsert!.cursorApiKeyIv!, capture.lastInsert!
        .cursorApiKeyEncrypted!);
      expect(decrypted.cursorApiKey).toBe("sk-test-secret");
      expect(verifyCursorApiKeyMock).toHaveBeenCalledTimes(1);
      expect(verifyCursorApiKeyMock).toHaveBeenCalledWith("sk-test-secret");
    },
    15_000,
  );

  it("clears stored key without calling Cursor.verify when field is empty", async () => {
    const { saveUserSettings } = await import("@/lib/settings/actions.js");
    const r = await saveUserSettings("  \n  ");
    expect(r).toEqual({ success: true });
    expect(verifyCursorApiKeyMock).not.toHaveBeenCalled();
    expect(capture.lastInsert?.cursorApiKeyEncrypted).toBeNull();
    expect(capture.lastInsert?.cursorApiKeyIv).toBeNull();
  });
});

describe("verifyAndSaveCursorApiKey", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    capture.lastInsert = null;
    verifyCursorApiKeyMock.mockClear();
    verifyCursorApiKeyMock.mockResolvedValue({ ok: true });
  });

  it("encrypts key only after verifier returns ok", async () => {
    process.env.ENCRYPTION_KEY = testKeyHex;
    const { verifyAndSaveCursorApiKey } = await import("@/lib/settings/actions.js");
    const r = await verifyAndSaveCursorApiKey("  sk-live  ");
    expect(r).toEqual({ success: true });
    expect(capture.lastInsert?.userId).toBe("user-phase2");
    const decrypted = decryptCredential(capture.lastInsert!.cursorApiKeyIv!, capture.lastInsert!
      .cursorApiKeyEncrypted!);
    expect(decrypted.cursorApiKey).toBe("sk-live");
    expect(verifyCursorApiKeyMock).toHaveBeenCalledWith("sk-live");
  });

  it("returns failure and does not write when verifier rejects", async () => {
    process.env.ENCRYPTION_KEY = testKeyHex;
    verifyCursorApiKeyMock.mockResolvedValueOnce({ ok: false, reason: "invalid_credentials" });
    const { verifyAndSaveCursorApiKey } = await import("@/lib/settings/actions.js");
    const r = await verifyAndSaveCursorApiKey("sk-bad");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.message.length).toBeGreaterThan(4);
    }
    expect(capture.lastInsert).toBeNull();
  });
});
