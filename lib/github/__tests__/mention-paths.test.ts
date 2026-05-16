import { describe, expect, it } from "vitest";

import { parseMentionedRepoPaths } from "@/lib/github/mention-paths";

describe("parseMentionedRepoPaths", () => {
  it("extracts bare paths and caps count", () => {
    const msg =
      "See lib/a.ts lib/b.ts lib/c.ts lib/d.ts lib/e.ts lib/f.ts components/x.tsx";
    const paths = parseMentionedRepoPaths(msg);
    expect(paths.length).toBe(5);
    expect(paths[0]).toBe("lib/a.ts");
  });

  it("parses backtick-wrapped paths", () => {
    const paths = parseMentionedRepoPaths("Open `lib/missions/actions.ts` please");
    expect(paths).toContain("lib/missions/actions.ts");
  });

  it("ignores paths outside known roots", () => {
    expect(parseMentionedRepoPaths("foo/bar.ts")).toEqual([]);
  });
});
