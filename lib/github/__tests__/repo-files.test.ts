import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/client", () => ({
  getInstallationToken: vi.fn(async () => "tok"),
}));

vi.mock("@/lib/github/repo-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github/repo-context")>(
    "@/lib/github/repo-context",
  );
  return {
    ...actual,
    resolveRepoUrl: vi.fn(async () => "https://github.com/acme/mercflow"),
  };
});

import {
  listRepoPath,
  MAX_REPO_FILE_BYTES,
  normalizeRepoPath,
  readRepoFile,
  RepoFileAccessError,
} from "@/lib/github/repo-files";

describe("normalizeRepoPath", () => {
  it("rejects traversal", () => {
    expect(() => normalizeRepoPath("lib/../.env", "file")).toThrow(RepoFileAccessError);
  });

  it("rejects .env segments", () => {
    expect(() => normalizeRepoPath("lib/.env", "file")).toThrow(RepoFileAccessError);
  });

  it("rejects disallowed file extensions", () => {
    expect(() => normalizeRepoPath("lib/foo.exe", "file")).toThrow(RepoFileAccessError);
  });

  it("accepts allowed file paths", () => {
    expect(normalizeRepoPath("lib/foo.ts", "file")).toBe("lib/foo.ts");
  });

  it("allows directories without file extension", () => {
    expect(normalizeRepoPath("lib/missions", "dir")).toBe("lib/missions");
  });
});

describe("readRepoFile / listRepoPath", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("readRepoFile returns decoded content", async () => {
    const raw = Buffer.from("hello world", "utf-8").toString("base64");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        type: "file",
        encoding: "base64",
        content: raw,
      }),
    });

    const out = await readRepoFile("biz-1", "lib/hello.ts");
    expect(out.content).toBe("hello world");
    expect(out.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/repos/acme/mercflow/contents/lib/hello.ts");
  });

  it("readRepoFile sets truncated when content exceeds cap", async () => {
    const big = "x".repeat(MAX_REPO_FILE_BYTES + 500);
    const raw = Buffer.from(big, "utf-8").toString("base64");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        type: "file",
        encoding: "base64",
        content: raw,
      }),
    });

    const out = await readRepoFile("biz-1", "lib/big.ts");
    expect(out.truncated).toBe(true);
    expect(Buffer.byteLength(out.content, "utf8")).toBeLessThanOrEqual(MAX_REPO_FILE_BYTES);
  });

  it("listRepoPath maps directory entries", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { type: "file", name: "actions.ts", path: "lib/missions/actions.ts" },
        { type: "dir", name: "foo", path: "lib/missions/foo" },
      ],
    });

    const out = await listRepoPath("biz-1", "lib/missions");
    expect(out.entries).toHaveLength(2);
    expect(out.entries[0]?.type).toBe("file");
    expect(out.entries[1]?.type).toBe("dir");
  });

  it("readRepoFile throws when GitHub returns 404", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(readRepoFile("biz-1", "lib/nope.ts")).rejects.toThrow(RepoFileAccessError);
  });
});
