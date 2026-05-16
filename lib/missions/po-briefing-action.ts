"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/index";
import { approvals, businesses, memory, missions, sprints } from "@/db/schema";
import { runServerAgentOnce } from "@/lib/cursor/server-agent";
import { buildRepoContextForPrompt } from "@/lib/github/repo-context";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";
import { loadAgentSoulMarkdown } from "@/lib/missions/load-agent-soul";
import { resolveCursorApiKeyForBusiness } from "@/lib/settings/cursor-api-key";

/** Plain-text-ish snippet when missions have no dedicated `goal` column. */
function missionGoalSummary(prd: string, validationContract: string): string {
  const strip = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const fromPrd = strip(prd);
  if (fromPrd)
    return fromPrd.length > 480 ? `${fromPrd.slice(0, 480)}…` : fromPrd;
  const fromVc = strip(validationContract);
  if (fromVc)
    return fromVc.length > 480 ? `${fromVc.slice(0, 480)}…` : fromVc;
  return "(Ikke angivet endnu — se PRD og valideringskontrakt.)";
}

/** MVP placeholder markdown until a real PO agent runs. */
function buildSimulatedSprintBrief(params: {
  missionName: string;
  missionGoalLine: string;
  validationContract: string;
  soulMarkdown: string;
}): string {
  const { missionName, missionGoalLine, validationContract, soulMarkdown } =
    params;
  return [
    `# Sprint brief (simuleret) — ${missionName}`,
    "",
    "## 1. Sprint mål",
    "",
    `Levere et første, review-klart udkast til **${missionName}** med klare leverancer og testbare kriterier, så teamet kan gå i gang efter godkendelse.`,
    "",
    "## 2. User stories",
    "",
    "### Som business owner vil jeg have en konkret måldefinition, så jeg ved hvornår vi er \"done\"",
    "**Acceptance criteria**",
    "- Sprint briefet linker missionens mål til valideringskontrakten.",
    "- Der er mindst ét målbart udkom beskrevet på menneskeligt sprog.",
    "",
    "### Som Product Owner vil jeg have prioriterede brugerhistorier, så udviklere ikke gætter scope",
    "**Acceptance criteria**",
    "- 5–8 historier er formulerede i \"Som … vil jeg … så …\" format.",
    "- Hver historie har 2–4 acceptance criteria.",
    "",
    "### Som udvikler vil jeg have teknik-afklaringer upfront, så vi undgår sen scope-sprængning",
    "**Acceptance criteria**",
    "- Åbne spørgsmål er eksplicit listet med ejer-forslag (business).",
    "- Risici og afhængigheder er navngivne (selv hvis de er antagelser).",
    "",
    "### Som reviewer vil jeg kunne godkende briefet i Approvals, så vi låser planen før execution",
    "**Acceptance criteria**",
    "- Briefet er ét sammenhængende markdown-dokument (denne sprint `goal` felt).",
    "- Godkendelse opretter et entydigt spor (approval + sprint i `planning`).",
    "",
    "### Som team vil jeg have sporbarhed til business context, så beslutninger ikke mister \"hvorfor\"",
    "**Acceptance criteria**",
    "- Business soul er refereret (eller markeret som manglende).",
    "- Afvigelser fra soul er ikke skjulte (hvis der er konflikt, nævnes det).",
    "",
    "## 3. Valideringskontrakt (input fra mission)",
    "",
    validationContract.trim() || "_Ingen valideringskontrakt endnu._",
    "",
    "## 4. Business context (soul — uddrag / reference)",
    "",
    soulMarkdown.trim() ? soulMarkdown.trim() : "_Ingen soul-dokument endnu._",
    "",
    "## 5. Åbne spørgsmål til business owner",
    "",
    `- Hvad er den skrappeste risiko ved at levere \"${missionName}\" i én sprint-iteration?`,
    "- Er der eksisterende deadlines, compliance-krav eller brand-krav vi skal låse fast nu?",
    "- Hvad er Ikke-scope for denne første sprint?",
    "",
    "## 6. Risici og afhængigheder",
    "",
    `- **Scope:** Briefet er baseret på missionens PRD/resumé: ${missionGoalLine.slice(0, 140)}${missionGoalLine.length > 140 ? "…" : ""}`,
    "- **Soul:** Manglende eller forældet soul kan give forkerte prioriteter.",
    "- **Teknik:** Afhængigheder til eksterne systemer/integrationer kan kræve manuel opsætning.",
    "",
    "_Dette dokument er MVP-simuleret PO-output._",
  ].join("\n");
}

function buildPoAgentPrompt(params: {
  agentSoulMarkdown: string;
  businessName: string;
  missionName: string;
  missionGoalLine: string;
  validationContract: string;
  soulMarkdown: string;
  repoContext: string | null;
}): string {
  const repoBlock = params.repoContext
    ? params.repoContext
    : "> No GitHub repository connected for this workspace. If codebase grounding is required, state that GitHub is not linked (Settings → Integrations). Do not invent files or directories.";

  const ghConnected = !!params.repoContext;
  const roleLines = ghConnected
    ? [
        "You are the **Product Owner** for this business (server-side agent).",
        "You have **no** local filesystem; repository context below comes only from the injected GitHub snapshot.",
        "Ground backlog and risks in that snapshot when relevant.",
        "Do **not** tell the operator to connect GitHub when a snapshot is present.",
      ]
    : [
        "You are the **Product Owner** for this business (server-side agent).",
        "No GitHub snapshot is available — do **not** invent repository structure or file paths.",
      ];

  const chunks: string[] = [];

  if (params.agentSoulMarkdown.trim()) {
    chunks.push(params.agentSoulMarkdown.trim(), "", "---", "");
  }

  chunks.push(
    "## Role context",
    ...roleLines,
    "",
    "## Business",
    `Name: **${params.businessName}**`,
    "",
    "## GitHub repository snapshot",
    repoBlock,
    "",
    "## Mission",
    `**Name:** ${params.missionName}`,
    "",
    "**Goal / PRD summary:**",
    params.missionGoalLine,
    "",
    "**Validation contract (definition of done):**",
    params.validationContract.trim() || "_Empty — call this out explicitly in open questions._",
    "",
    "## Business memory (soul)",
    params.soulMarkdown.trim() || "_No business soul document yet._",
    "",
    "## Task",
    "Produce a single **sprint brief** as **markdown** suitable for human approval.",
    "Include clearly labeled sections:",
    "- Sprint goal (one crisp sentence)",
    "- User stories (5–8) in \"As a … I want … so that …\" form with 2–4 acceptance criteria each",
    "- Risks and dependencies",
    "- Open questions for the business owner",
    "",
    "Ground statements in the mission, validation contract, business soul, and repository snapshot when present.",
    "Respond with **markdown only** (no JSON wrapper).",
    "",
    "User: Generate the sprint brief now.",
    "",
    "Assistant:",
  );

  return chunks.join("\n");
}

export async function runProductOwnerBriefing(
  businessId: string,
  missionId: string,
): Promise<
  | { success: true; sprintId: string; approvalId: string }
  | { success: false; error: string }
> {
  try {
    const userId = await requireSessionUserId();
    await assertUserBusinessAccess(userId, businessId);

    const db = getDb();
    const mission = await db.query.missions.findFirst({
      where: eq(missions.id, missionId),
    });
    if (!mission || mission.businessId !== businessId) {
      return { success: false, error: "Mission not found" };
    }

    const businessRow = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId),
      columns: { name: true },
    });
    const businessName = businessRow?.name?.trim() || businessId;

    const soulRows = await db
      .select({ content: memory.content })
      .from(memory)
      .where(and(eq(memory.businessId, businessId), eq(memory.scope, "business")))
      .orderBy(desc(memory.updatedAt))
      .limit(1);
    const soulMarkdown = soulRows[0]?.content?.trim() ? soulRows[0].content : "";

    const missionGoalLine = missionGoalSummary(
      mission.prd,
      mission.validationContract,
    );

    const agentSoulMarkdown = await loadAgentSoulMarkdown(businessId, "product_owner");

    const apiKey = await resolveCursorApiKeyForBusiness(businessId).catch(() => null);

    let poOutputMarkdown: string;

    if (!apiKey) {
      poOutputMarkdown = buildSimulatedSprintBrief({
        missionName: mission.name,
        missionGoalLine,
        validationContract: mission.validationContract,
        soulMarkdown,
      });
    } else {
      const repoContext = await buildRepoContextForPrompt(businessId).catch(() => null);
      const poPrompt = buildPoAgentPrompt({
        agentSoulMarkdown,
        businessName,
        missionName: mission.name,
        missionGoalLine,
        validationContract: mission.validationContract,
        soulMarkdown,
        repoContext,
      });

      try {
        const agentText = await runServerAgentOnce(poPrompt, apiKey);
        if (!agentText.trim()) {
          poOutputMarkdown = buildSimulatedSprintBrief({
            missionName: mission.name,
            missionGoalLine,
            validationContract: mission.validationContract,
            soulMarkdown,
          }).concat("\n\n", "_Agent returned empty output; using simulated brief as fallback._");
        } else {
          poOutputMarkdown = agentText;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        poOutputMarkdown = buildSimulatedSprintBrief({
          missionName: mission.name,
          missionGoalLine,
          validationContract: mission.validationContract,
          soulMarkdown,
        }).concat("\n\n", `_Agent error (${msg}); using simulated brief as fallback._`);
      }
    }

    // Neon HTTP driver does not support transactions; use sequential inserts with
    // manual cleanup on failure to avoid orphan rows.
    const existingSprint = await db.query.sprints.findFirst({
      where: eq(sprints.missionId, missionId),
      columns: { id: true },
    });
    if (existingSprint) {
      return { success: false, error: "Mission already has a sprint brief" };
    }

    const [sprintRow] = await db
      .insert(sprints)
      .values({
        missionId,
        name: "Sprint 1",
        goal: poOutputMarkdown,
        status: "planning",
      })
      .returning({ id: sprints.id });

    if (!sprintRow?.id) throw new Error("Failed to create sprint");

    const approvalTitle = `PO Sprint Brief — ${mission.name}`;
    let approvalRow: { id: string } | undefined;
    try {
      const rows = await db
        .insert(approvals)
        .values({
          businessId,
          agentId: null,
          artifactRef: {
            kind: "mission",
            missionId,
            sprintId: sprintRow.id,
            title: approvalTitle,
            artifactType: "po_sprint_brief",
          },
        })
        .returning({ id: approvals.id });
      approvalRow = rows[0];
    } catch (approvalErr) {
      // Approval failed — remove the orphan sprint row and propagate.
      await db.delete(sprints).where(eq(sprints.id, sprintRow.id)).catch(() => {});
      throw approvalErr;
    }

    if (!approvalRow?.id) throw new Error("Failed to create approval");

    const sprintId = sprintRow.id;
    const approvalId = approvalRow.id;

    revalidatePath("/dashboard/approvals");
    revalidatePath(`/dashboard/missions/${missionId}`);

    return { success: true, sprintId, approvalId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to run PO briefing";
    return { success: false, error: message };
  }
}
