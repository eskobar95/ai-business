export type ParsedMissionProposal = {
  name: string;
  goal: string;
  validationContract: string;
  projectType: "new_project" | "existing_codebase" | "feature" | "bugfix";
};

const PROJECT_TYPES = new Set<ParsedMissionProposal["projectType"]>([
  "new_project",
  "existing_codebase",
  "feature",
  "bugfix",
]);

const BLOCK_PATTERN = "<mission\\b[^>]*>([\\s\\S]*?)</mission>";

function collectMissionBlocks(text: string): { innerContents: string[]; strippedText: string } {
  const scanRe = new RegExp(BLOCK_PATTERN, "gi");
  const innerContents: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = scanRe.exec(text)) !== null) {
    innerContents.push(m[1] ?? "");
  }
  const stripRe = new RegExp(BLOCK_PATTERN, "gi");
  const strippedText = text.replace(stripRe, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  return { innerContents, strippedText };
}

function normalizeProjectType(raw: string | undefined): ParsedMissionProposal["projectType"] {
  if (!raw?.trim()) return "feature";
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, ParsedMissionProposal["projectType"]> = {
    new_project: "new_project",
    newproject: "new_project",
    existing_codebase: "existing_codebase",
    existingcodebase: "existing_codebase",
    feature: "feature",
    bugfix: "bugfix",
    bug_fix: "bugfix",
  };
  const mapped = aliases[v];
  if (mapped && PROJECT_TYPES.has(mapped)) return mapped;
  return PROJECT_TYPES.has(v as ParsedMissionProposal["projectType"])
    ? (v as ParsedMissionProposal["projectType"])
    : "feature";
}

function parseMissionBlockInner(inner: string): ParsedMissionProposal | null {
  const lines = inner.replace(/\r\n/g, "\n").split("\n");
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;

  const keyRe = /^\s*(name|goal|validationContract|projectType)\s*:\s*(.*)$/i;

  for (const line of lines) {
    const m = line.match(keyRe);
    if (m?.[1]) {
      currentKey = m[1].toLowerCase();
      fields[currentKey] = (m[2] ?? "").trimStart();
      continue;
    }
    if (currentKey && fields[currentKey] !== undefined && line.trim()) {
      fields[currentKey] = `${fields[currentKey]}\n${line.trimEnd()}`;
    }
  }

  const name = (fields.name ?? "").trim();
  if (name.length < 2) return null;

  const goal = (fields.goal ?? "").trim();
  const validationContract = (fields.validationcontract ?? "").trim();

  return {
    name,
    goal,
    validationContract,
    projectType: normalizeProjectType(fields.projecttype),
  };
}

/**
 * Extracts `<mission>...</mission>` blocks from assistant text and removes them from display content.
 */
export function parseMissionProposals(text: string): {
  proposals: ParsedMissionProposal[];
  strippedText: string;
} {
  if (!text.includes("<mission")) {
    return { proposals: [], strippedText: text };
  }

  const { innerContents, strippedText } = collectMissionBlocks(text);
  const proposals: ParsedMissionProposal[] = [];
  for (const inner of innerContents) {
    const parsed = parseMissionBlockInner(inner);
    if (parsed) proposals.push(parsed);
  }

  return { proposals, strippedText };
}
