import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const findManyMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/lib/agents/actions", () => ({
  assertUserOwnsAgent: vi.fn(async () => ({ userId: "u1", businessId: "b1", isPlatformDefault: false })),
}));

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        agentDocuments: {
          findFirst: findFirstMock,
          findMany: findManyMock,
        },
      },
      update: updateMock,
      insert: insertMock,
    };
  },
}));

import {
  getAgentDocuments,
  updateAgentDocument,
} from "@/lib/agents/document-actions.js";
import { DEFAULT_DOC_SLUG } from "@/lib/agents/document-model.js";

describe("getAgentDocuments", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("prepends default agent slug when missing so agent.md is always present", async () => {
    findManyMock.mockResolvedValueOnce([
      { slug: "notes", content: "N", filename: "notes.md" },
    ]);
    const docs = await getAgentDocuments("agent-1");
    expect(docs.some((d) => d.slug === DEFAULT_DOC_SLUG)).toBe(true);
    expect(docs.find((d) => d.slug === DEFAULT_DOC_SLUG)?.content).toBe("");
    expect(docs.find((d) => d.slug === DEFAULT_DOC_SLUG)?.filename).toBe("agent.md");
    expect(docs.find((d) => d.slug === "notes")?.content).toBe("N");
  });

  it("does not duplicate default slug when already in rows", async () => {
    findManyMock.mockResolvedValueOnce([
      { slug: DEFAULT_DOC_SLUG, content: "X", filename: "agent.md" },
      { slug: "notes", content: "N", filename: "notes.md" },
    ]);
    const docs = await getAgentDocuments("agent-1");
    expect(docs.filter((d) => d.slug === DEFAULT_DOC_SLUG)).toHaveLength(1);
    expect(docs.find((d) => d.slug === DEFAULT_DOC_SLUG)?.content).toBe("X");
  });
});

describe("updateAgentDocument", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    insertMock.mockReset();
  });

  it("rejects empty slug", async () => {
    await expect(updateAgentDocument("agent-1", "", "x")).rejects.toThrow(
      "Slug is required",
    );
  });

  it("rejects whitespace-only slug", async () => {
    await expect(updateAgentDocument("agent-1", "   ", "x")).rejects.toThrow(
      "Slug is required",
    );
  });

  it("updates existing row", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "doc-1" });
    updateMock.mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    await updateAgentDocument("agent-1", "tools", "## tools");
    expect(updateMock).toHaveBeenCalled();
  });

  it("inserts when row missing", async () => {
    findFirstMock.mockResolvedValueOnce(undefined);
    insertMock.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    await updateAgentDocument("agent-1", "heartbeat", "## hb");
    expect(insertMock).toHaveBeenCalled();
  });
});
