"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/index";
import { approvals, businesses, memory, missions, sprints } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";

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

    const poPrompt = `
Du er Product Owner for ${businessName}.

Mission: ${mission.name}
Mål: ${missionGoalLine}
Validation contract (done-criteria):
${mission.validationContract}

Business soul:
${soulMarkdown || "Ingen soul-dokument endnu."}

Producér et struktureret sprint brief med:
1. Sprint mål (1 sætning)
2. User stories (5-8 stories: "Som [rolle] vil jeg [handling] så jeg [værdi]")
3. Acceptance criteria per story
4. Åbne spørgsmål til business owner
5. Risici og afhængigheder

Svar i markdown.
`.trim();

    // TODO: wire runCursorAgent when agent runtime is ready (pass poPrompt instead of simulated output below)
    const poOutputMarkdown = buildSimulatedSprintBrief({
      missionName: mission.name,
      missionGoalLine,
      validationContract: mission.validationContract,
      soulMarkdown,
    }).concat("\n\n", `_MVP-note: Prepared PO prompt (${poPrompt.length} characters). Replace with agent output later._`);

    // Wrap existence check + sprint insert + approval insert in a single transaction
    // to prevent TOCTOU races (two concurrent calls both passing the check) and
    // partial failures (orphan sprint with no approval artifact).
    const { sprintId, approvalId } = await db.transaction(async (tx) => {
      const existingSprint = await tx.query.sprints.findFirst({
        where: eq(sprints.missionId, missionId),
        columns: { id: true },
      });
      if (existingSprint) {
        throw new Error("Mission already has a sprint brief");
      }

      const [sprintRow] = await tx
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
      const [approvalRow] = await tx
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

      if (!approvalRow?.id) throw new Error("Failed to create approval");

      return { sprintId: sprintRow.id, approvalId: approvalRow.id };
    });

    revalidatePath("/dashboard/approvals");
    revalidatePath(`/dashboard/missions/${missionId}`);

    return { success: true, sprintId, approvalId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to run PO briefing";
    return { success: false, error: message };
  }
}
