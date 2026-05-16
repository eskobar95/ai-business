import { describe, expect, it } from "vitest";

import { parseMissionProposals } from "@/lib/chat/parse-mission-proposals";

describe("parseMissionProposals", () => {
  it("returns original text when no mission blocks", () => {
    const t = "Hello\n\nNo XML here.";
    const r = parseMissionProposals(t);
    expect(r.proposals).toEqual([]);
    expect(r.strippedText).toBe(t);
  });

  it("parses a single mission block and strips it from content", () => {
    const input = [
      "Here is my analysis.",
      "",
      "<mission>",
      "name: Build auth flow",
      "goal: Implement email + social login",
      "validationContract: Users can sign up, sign in, reset password",
      "projectType: feature",
      "</mission>",
    ].join("\n");

    const r = parseMissionProposals(input);
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0]).toEqual({
      name: "Build auth flow",
      goal: "Implement email + social login",
      validationContract: "Users can sign up, sign in, reset password",
      projectType: "feature",
    });
    expect(r.strippedText.trim()).toBe("Here is my analysis.");
  });

  it("parses multiple blocks", () => {
    const input = [
      "Intro",
      "<mission>",
      "name: Mission A",
      "goal: Ga",
      "validationContract: Va",
      "</mission>",
      "Middle",
      "<mission>",
      "name: Mission B",
      "goal: Gb",
      "validationContract: Vb",
      "projectType: bugfix",
      "</mission>",
    ].join("\n");

    const r = parseMissionProposals(input);
    expect(r.proposals).toHaveLength(2);
    expect(r.proposals[0]!.name).toBe("Mission A");
    expect(r.proposals[1]!.projectType).toBe("bugfix");
    expect(r.strippedText).toContain("Intro");
    expect(r.strippedText).toContain("Middle");
    expect(r.strippedText).not.toContain("<mission>");
  });

  it("defaults projectType to feature when missing", () => {
    const input = [
      "<mission>",
      "name: Only name",
      "goal: Some goal",
      "validationContract: Some criteria",
      "</mission>",
    ].join("\n");

    const r = parseMissionProposals(input);
    expect(r.proposals[0]!.projectType).toBe("feature");
  });

  it("drops blocks without a usable name", () => {
    const input = [
      "<mission>",
      "goal: x",
      "validationContract: y",
      "</mission>",
      "Tail",
    ].join("\n");

    const r = parseMissionProposals(input);
    expect(r.proposals).toHaveLength(0);
    expect(r.strippedText).toContain("Tail");
  });

  it("continues multiline goal onto following lines", () => {
    const input = [
      "<mission>",
      "name: Multi",
      "goal: Line one",
      "Still goal continuation",
      "validationContract: Done",
      "</mission>",
    ].join("\n");

    const r = parseMissionProposals(input);
    expect(r.proposals[0]!.goal).toContain("Line one");
    expect(r.proposals[0]!.goal).toContain("Still goal continuation");
  });
});
