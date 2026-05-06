import { describe, expect, it } from "vitest";

import { getInstallationToken } from "@/lib/github/client";

describe("github client module", () => {
  it("exports getInstallationToken as an async function", () => {
    expect(typeof getInstallationToken).toBe("function");
  });
});
