import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Mirrors `cronField` in `actions.ts` (keep in sync when changing validation). */
const cronField = z
  .string()
  .min(1)
  .refine((s) => {
    const parts = s.trim().split(/\s+/);
    return parts.length === 5;
  }, "Cron must have 5 fields (minute hour day month weekday)");

describe("routines cron validation", () => {
  it("accepts a standard five-field expression", () => {
    expect(cronField.safeParse("0 8 * * *").success).toBe(true);
  });

  it("rejects fewer than five fields", () => {
    expect(cronField.safeParse("* * *").success).toBe(false);
  });
});
