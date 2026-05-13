"use server";

import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { buildGrillChatTurnPrompt } from "@/lib/grill-me/grill-chat-turn-prompt";
import { mergeGrillMeCursorAgentOptions } from "@/lib/grill-me/grill-cursor-runtime";
import {
  coerceGrillReasoningContext,
  minimalFallbackReasoningContext,
  type GrillReasoningContext,
} from "@/lib/grill-me/grill-reasoning-types";
import { GRILL_ME_COMPLETE_MARKER } from "@/lib/grill-me/markers";
import {
  formatSoulNavGapSummary,
  parseSoulMarkdownSections,
} from "@/lib/grill-me/soul-section-parser";
import { normalizeSoulMarkdownForEditor } from "@/lib/grill-me/soul-markdown-normalize";
import { formatGrillTranscriptForSoulRefine } from "@/lib/grill-me/grill-transcript-for-refine";
import {
  isUnsafeSoulRefineOutput,
  wantsGuidanceOnlySoulTurn,
} from "@/lib/grill-me/soul-refine-safety";
import { loadGrillSkillAppendix } from "@/lib/grill-me/load-grill-skill-appendix";
import { runGrillReasoningPhase } from "@/lib/grill-me/reasoning-actions";
import {
  loadGrillMeSessionsForBusiness,
  type GrillMeMessage,
} from "@/lib/grill-me/session-queries";
import {
  extractAndStoreSoulFile,
  upsertBusinessSoulMarkdown,
} from "@/lib/grill-me/soul-memory";
import type { GrillBusinessType } from "@/lib/grill-me/grill-prompt";

import { auth } from "@/lib/auth/server";
import { getDb } from "@/db/index";
import {
  businesses,
  grillMeSessions,
  memory,
  userBusinesses,
} from "@/db/schema";
import { runCursorAgent } from "@/lib/cursor/agent";
import { seedConductorAgent } from "@/lib/conductor/seed-conductor";
import { getUserCursorApiKeyDecrypted } from "@/lib/settings/cursor-api-key";
import { and, desc, eq, isNull, max, sql } from "drizzle-orm";

function normalizeOptionalText(v: string | undefined): string | null {
  const t = v?.trim() ?? "";
  return t.length ? t : null;
}

async function collectStream(iterable: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of iterable) out += chunk;
  return out;
}

function reasoningForTurn(
  businessType: GrillBusinessType,
  name: string,
  summary: string | null | undefined,
  rawStored: unknown,
): GrillReasoningContext {
  if (rawStored && typeof rawStored === "object") {
    const coerced = coerceGrillReasoningContext(rawStored as Record<string, unknown>);
    if (coerced) return coerced;
  }
  return minimalFallbackReasoningContext(businessType, name, summary);
}

export async function createBusiness(name: string): Promise<{ id: string }> {
  return createBusinessWithDetails({ name });
}

export async function createBusinessWithDetails(data: {
  name: string;
  description?: string;
  githubRepoUrl?: string;
}): Promise<{ id: string }> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Business name must not be empty");
  }

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  const [biz] = await db
    .insert(businesses)
    .values({
      name: trimmedName,
      description: normalizeOptionalText(data.description),
      githubRepoUrl: normalizeOptionalText(data.githubRepoUrl),
      onboardingPhase: "grill_chat",
    })
    .returning({ id: businesses.id });

  if (!biz) throw new Error("Failed to create business");

  await db.insert(userBusinesses).values({
    userId,
    businessId: biz.id,
  });

  await seedConductorAgent(biz.id);

  return { id: biz.id };
}

/**
 * Removes a business created during onboarding when setup failed before the Grill chat starts.
 * Only runs when there are no Grill-Me turns and no memory rows — avoids wiping active tenants.
 */
export async function deleteOnboardingDraftBusiness(
  businessId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    await assertUserBusinessAccess(userId, businessId);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const db = getDb();
  const existingTurn = await db.query.grillMeSessions.findFirst({
    where: eq(grillMeSessions.businessId, businessId),
    columns: { id: true },
  });
  if (existingTurn) {
    return {
      ok: false,
      error:
        "Cannot remove draft: Grill-Me messages already exist for this business.",
    };
  }

  const existingMemory = await db.query.memory.findFirst({
    where: eq(memory.businessId, businessId),
    columns: { id: true },
  });
  if (existingMemory) {
    return {
      ok: false,
      error:
        "Cannot remove draft: this business already has memory rows stored.",
    };
  }

  await db.delete(businesses).where(eq(businesses.id, businessId));
  return { ok: true };
}

/** Hydrate editor interview panel — ordered Grill-Me DB turns. */
export async function getGrillInterviewTranscript(
  businessId: string,
): Promise<
  { ok: true; turns: GrillMeMessage[] } | { ok: false; error: string }
> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    await assertUserBusinessAccess(userId, businessId);
  } catch {
    return { ok: false, error: "Forbidden" };
  }
  const turns = await loadGrillMeSessionsForBusiness(businessId);
  return { ok: true, turns };
}

/** Update the onboarding wizard phase stored on the business row. */
export async function updateOnboardingPhase(
  businessId: string,
  phase: "grill_chat" | "grill_editor" | "complete",
): Promise<void> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") throw new Error("Unauthorized");
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  await db
    .update(businesses)
    .set({ onboardingPhase: phase })
    .where(eq(businesses.id, businessId));
}

/**
 * Persist soul markdown during onboarding (e.g. soul editor autosave).
 * Set `completeOnboarding: true` only when the user finishes the wizard (Done → celebration),
 * not on intermediate autosaves — otherwise `getActiveOnboardingBusiness` stops finding the row.
 */
export async function saveBusinessSoulFromOnboarding(
  businessId: string,
  markdown: string,
  options?: { completeOnboarding?: boolean },
): Promise<{ success: true }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  await assertUserBusinessAccess(userId, businessId);
  await upsertBusinessSoulMarkdown(businessId, markdown);
  if (options?.completeOnboarding) {
    await db
      .update(businesses)
      .set({ onboardingPhase: "complete" })
      .where(eq(businesses.id, businessId));
  }
  return { success: true };
}

/**
 * Find the most recent business for the current user that has an in-progress
 * onboarding phase. Returns null when there is nothing to resume.
 */
export async function getActiveOnboardingBusiness(): Promise<{
  businessId: string;
  bizName: string;
  onboardingPhase: "grill_chat" | "grill_editor";
  turns: GrillMeMessage[];
  soulMarkdown: string | null;
  /** From Grill reasoning context when present; else \`existing\`. */
  businessProfile: GrillBusinessType;
} | null> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") return null;

  const db = getDb();

  // Find most recently created business that is still in onboarding
  const row = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      onboardingPhase: businesses.onboardingPhase,
      grillReasoningContext: businesses.grillReasoningContext,
    })
    .from(businesses)
    .innerJoin(userBusinesses, eq(userBusinesses.businessId, businesses.id))
    .where(
      and(
        eq(userBusinesses.userId, userId),
        sql`${businesses.onboardingPhase} IN ('grill_chat', 'grill_editor')`,
      ),
    )
    .orderBy(desc(businesses.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row || !row.onboardingPhase) return null;

  let businessProfile: GrillBusinessType = "existing";
  const grc = row.grillReasoningContext;
  if (grc && typeof grc === "object" && !Array.isArray(grc)) {
    const coerced = coerceGrillReasoningContext(grc as Record<string, unknown>);
    if (coerced?.businessType) businessProfile = coerced.businessType;
  }

  const [turns, soulRow] = await Promise.all([
    loadGrillMeSessionsForBusiness(row.id),
    db.query.memory.findFirst({
      where: and(
        eq(memory.businessId, row.id),
        eq(memory.scope, "business"),
        isNull(memory.agentId),
      ),
    }),
  ]);

  return {
    businessId: row.id,
    bizName: row.name,
    onboardingPhase: row.onboardingPhase as "grill_chat" | "grill_editor",
    turns,
    soulMarkdown: soulRow?.content ?? null,
    businessProfile,
  };
}

export async function startGrillMeTurn(
  businessId: string,
  userMessage: string,
  businessType: GrillBusinessType = "existing",
  autoStart = false,
): Promise<{ assistantReply: string; soulStored: boolean }> {
  const trimmed = userMessage.trim();
  if (!trimmed && !autoStart) throw new Error("Message must not be empty");

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  await assertUserBusinessAccess(userId, businessId);

  let bizRow = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  });
  if (!bizRow) throw new Error("Business not found");

  if (bizRow.grillReasoningContext == null) {
    await runGrillReasoningPhase(businessId, businessType);
    bizRow =
      (await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      })) ?? bizRow;
  }

  const reasoning = reasoningForTurn(
    businessType,
    bizRow.name,
    bizRow.description,
    bizRow.grillReasoningContext,
  );

  const [{ nextSeq }] = await db
    .select({ nextSeq: sql<number>`coalesce(${max(grillMeSessions.seq)}, 0)` })
    .from(grillMeSessions)
    .where(eq(grillMeSessions.businessId, businessId));

  let userSeq = Number(nextSeq);

  if (!autoStart) {
    userSeq += 1;
    await db.insert(grillMeSessions).values({
      businessId,
      role: "user",
      content: trimmed,
      seq: userSeq,
    });
  }

  const historyRows = await db
    .select()
    .from(grillMeSessions)
    .where(eq(grillMeSessions.businessId, businessId))
    .orderBy(desc(grillMeSessions.seq));

  const chronological = [...historyRows].reverse();
  const prior = autoStart ? chronological : chronological.slice(0, -1);
  const transcript = prior.map((row) =>
    row.role === "user"
      ? { role: "user" as const, content: row.content }
      : { role: "assistant" as const, content: row.content },
  );

  const prompt = buildGrillChatTurnPrompt(
    transcript,
    autoStart ? "" : trimmed,
    businessType,
    reasoning,
    {
      skillAppendix: await loadGrillSkillAppendix(),
      autoStart,
    },
  );
  const cursorApiKey = await getUserCursorApiKeyDecrypted();
  const stream = await runCursorAgent(prompt, mergeGrillMeCursorAgentOptions(cursorApiKey));
  const assistantText = await collectStream(stream);

  const assistantSeq = userSeq + 1;
  await db.insert(grillMeSessions).values({
    businessId,
    role: "assistant",
    content: assistantText,
    seq: assistantSeq,
  });

  let soulStored = false;
  if (assistantText.includes(GRILL_ME_COMPLETE_MARKER)) {
    await extractAndStoreSoulFile(businessId, assistantText);
    soulStored = true;
  }

  return { assistantReply: assistantText, soulStored };
}

/**
 * Load everything needed to resume an onboarding session:
 * existing chat turns + soul markdown (null if not yet captured).
 * Used by OnboardingClient on mount when localStorage has a saved businessId.
 */
export async function loadGrillResumeData(
  businessId: string,
): Promise<{
  turns: GrillMeMessage[];
  soulMarkdown: string | null;
  bizName: string;
}> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") throw new Error("Unauthorized");

  const db = getDb();
  await assertUserBusinessAccess(userId, businessId);

  const [bizRow, turns, soulRow] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(businesses.id, businessId) }),
    loadGrillMeSessionsForBusiness(businessId),
    db.query.memory.findFirst({
      where: and(
        eq(memory.businessId, businessId),
        eq(memory.scope, "business"),
        isNull(memory.agentId),
      ),
    }),
  ]);

  if (!bizRow) throw new Error("Business not found");

  return {
    turns,
    soulMarkdown: soulRow?.content ?? null,
    bizName: bizRow.name,
  };
}

const REFINE_REPLY_SPLIT = "---UPDATED_DOCUMENT---";

const REFINE_UNSAFE_REPLY_DA =
  "Jeg **gemte ikke** den foreslåede tekst: den var for kort eller manglede for mange sektioner i forhold til dit nuværende soul-dokument (tegn på at indhold kunne være slettet ved en fejl). **Dokumentet i editoren er uændret.** Når du vil have konkrete ændringer i filen, skriv tydeligt fx «opdater dokumentet og …».";

const MIN_OPENING_GUIDANCE_LEN = 80;

function soulEditorOpeningFallbackDa(
  bizName: string,
  profile: GrillBusinessType,
  soulMarkdown: string,
): string {
  const secs = parseSoulMarkdownSections(soulMarkdown);
  const firstHypothesis = secs.find((s) => s.confidence === "hypothesis");
  const firstUnknown = secs.find((s) => s.confidence === "unknown");
  const firstGap = firstHypothesis ?? firstUnknown;

  const focusLine = firstGap
    ? `Jeg starter med **§ ${firstGap.num}. ${firstGap.title}** (${firstGap.confidence}) — vi tager det skridt for skridt mod mere klarhed.`
    : "Jeg har gennemgået sektionerne: overordnet ser de **validerede** ud. Vi kan stadig skærpe identitet, prioriteringer og hvordan en prospect læser dokumentet.";

  const lines: string[] = [
    `Hej — **velkommen til prospekt-/soul-finpudsning** efter Grill-Me for **${bizName}**.`,
    "",
    "Giv mig et øjeblik: jeg har **gennemgået dokumentet** ud fra status pr. afsnit (validated, hypothesis, unknown). **Jeg driver spørgsmålene** — du skal ikke selv planlægge en stor \"gennemgang af alle unknowns\". Vi arbejder **ét tema ad gangen** i en fornuftig rækkefølge (typisk det, der låser fortællingen først).",
  ];

  if (profile === "new") {
    lines.push(
      "",
      "Du er **tidligt ude** — hypoteser og unknowns er forventelige; vi strammer formulering uden at opdigte fakta.",
    );
  }

  lines.push("", focusLine, "", "**Sådan arbejder vi**");

  if (firstHypothesis && firstUnknown && firstGap === firstHypothesis) {
    lines.push(
      "- Først hypothesis-afsnit der bærer kernefortællingen; derefter åbne unknowns.",
      "- Du svarer kort på mine spørgsmål — jeg holder fokus, indtil vi er trygge ved det aktuelle punkt.",
    );
  } else {
    lines.push(
      "- Vi går systematisk igennem, men **jeg vælger næste skridt** ud fra hullerne i dokumentet.",
      "- Du kan bruge hurtigsvar eller skrive frit; vi bygger videre ud fra dit svar.",
    );
  }

  if (firstGap) {
    lines.push(
      "",
      `**Mit første spørgsmål (§ ${firstGap.num})**`,
      "Hvad er den **vigtigste antagelse** her — kan du understøtte den med noget konkret (eksempel, tegn, data), eller skal vi formulere den ærligere som noget, der stadig skal afklares?",
      "",
      "A) Jeg kan pege på konkrete tegn eller eksempler, der understøtter antagelsen",
      "B) Det er stadig et gæt — vi skal afgrænse, hvad der skal valideres først",
      "C) Lad os skære antagelsen ned til én kort, testbar sætning",
      "D) Det her afsnit er for tidligt — lad os tage det næste hypothesis/unknown i stedet",
    );
  } else {
    lines.push(
      "",
      "**Mit første spørgsmål**",
      "Hvilken del af fortællingen vil du helst have **skarpere og mere prospect-klar** først — identitet og tilbud, målgruppe, troværdighed, eller \"næste skridt\" for læseren?",
      "",
      "A) Skærp **§ 1–3** (identitet, målgruppe, kernebudskab)",
      "B) Gør **værdi og næste skridt** tydeligere for en cold prospect",
      "C) Gennemgå **roller, beslutninger og risiko** (hvad skal de tro på?)",
      "D) Jeg citerer ét afsnit i næste besked — start der",
    );
  }

  return lines.join("\n");
}

/**
 * First turn in the soul-editor side chat: proactive Danish guidance, gap-aware,
 * ending with A)–D) lines for quick-reply chips. Falls back to a template if the agent returns too little.
 */
export async function getSoulEditorOpeningGuidance(
  businessId: string,
  soulMarkdown: string,
  options?: { businessProfile?: "new" | "existing" },
): Promise<{ guidance: string }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") throw new Error("Unauthorized");

  const db = getDb();
  await assertUserBusinessAccess(userId, businessId);

  const bizRow = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  });
  if (!bizRow) throw new Error("Business not found");

  const name = (bizRow.name ?? "din virksomhed").trim() || "din virksomhed";
  const profile: GrillBusinessType =
    options?.businessProfile === "new" ? "new" : "existing";
  const gapSummary = formatSoulNavGapSummary(soulMarkdown);

  const prompt = `You are a **lead interviewer** for the **soul / prospect document editor** on Conduro, right after Grill-Me. The founder sees the markdown in an editor and a side chat. **You** drive validation — the user must not get meta homework like "review all [UNKNOWN]" or a roadmap of sections as the main ask.

Company name: ${name}
Business profile: **${profile}** (${profile === "new" ? "early-stage; uncertainty is OK—never invent metrics or customers" : "operating; tighten [HYPOTHESIS]/[UNKNOWN] to honest facts where possible"})

Gap / section overview from tooling:
${gapSummary || "(no non-validated sections in sidebar summary — still offer focused polish)"}

## Soul document (reference only — do NOT output an edited document)

\`\`\`markdown
${soulMarkdown.trim()}
\`\`\`

Write **only** side-chat text in **Danish**. Do not output updated markdown or code fences.

Structure (follow in order):
1) **Hej** + short welcome: prospect/soul finpudsning efter Grill-Me; **giv mig et øjeblik** / du har **gennemgået** dokumentet ud fra status pr. afsnit.
2) One paragraph: **du** stiller spørgsmålene og vælger rækkefølgen (ét tema ad gangen; fornuftig orden — lås kernefortælling / hypothesis før du spreder dig på alle unknowns, medmindre dokumentet tydeligt kræver andet). Brugeren skal **ikke** have ansvaret for at planlægge en stor gennemgang.
3) **Første fokus**: navngiv **ét konkret afsnit** du starter i — brug gap summary: foretræk første **hypothesis**-afsnit, ellers første **unknown**, ellers sig at ting ser validerede ud og peg på skarpere prospect-vinkel.
4) **Sådan arbejder vi** — 2 korte bullets (fokusvalg + at brugeren kan svare med hurtigsvar eller frit).
5) **Et skarpt valideringsspørgsmål** rettet mod det afsnit (ikke en liste af valgmuligheder i brødteksten).

End with **exactly four** lines **A)–D)** — each must be a **direct answer** til dit spørgsmål (hvordan brugeren kan svare), **not** meta-options som "gennemgå alle unknowns" eller "gennem §4–6". Format only:
A) …
B) …
C) …
D) …

Use markdown in prose where helpful (**fed** til nøgleord). ~150–320 words; rolig konsulenttone, ikke marketing.`;

  try {
    const cursorApiKey = await getUserCursorApiKeyDecrypted();
    const stream = await runCursorAgent(prompt, mergeGrillMeCursorAgentOptions(cursorApiKey));
    const raw = (await collectStream(stream)).trim();
    if (raw.length >= MIN_OPENING_GUIDANCE_LEN) {
      return { guidance: raw };
    }
  } catch {
    /* use fallback */
  }

  return { guidance: soulEditorOpeningFallbackDa(name, profile, soulMarkdown) };
}

/**
 * Soul editor side-chat: user asks the AI to refine or explain the soul document.
 * Returns a conversational reply AND optionally an updated version of the document.
 */
export async function refineGrillSoulDocument(
  businessId: string,
  currentMarkdown: string,
  userMessage: string,
  quoteContext?: string,
  options?: { businessProfile?: "new" | "existing" },
): Promise<{ reply: string; updatedMarkdown: string | null }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") throw new Error("Unauthorized");

  const db = getDb();
  await assertUserBusinessAccess(userId, businessId);

  const bizRow = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
  });
  if (!bizRow) throw new Error("Business not found");

  const quoteSection = quoteContext?.trim()
    ? `\n\n## Quoted section from document\n\n> ${quoteContext.trim().replace(/\n/g, "\n> ")}\n`
    : "";

  const grillDigest = formatGrillTranscriptForSoulRefine(
    await loadGrillMeSessionsForBusiness(businessId),
  );
  const guidanceOnly = wantsGuidanceOnlySoulTurn(userMessage.trim());

  const gapSummary = formatSoulNavGapSummary(currentMarkdown);
  const profile = options?.businessProfile ?? "existing";
  const profileNote =
    profile === "new"
      ? `Business profile: **new / early-stage**. It is OK for many items to stay hypothesis or unknown—tighten language and separate facts from guesses; do not invent traction, revenue, or customers. Prefer short "what we need to validate" bullets over fake certainty.`
      : `Business profile: **existing / operating**. Prefer resolving [UNKNOWN] and [HYPOTHESIS] where the document or quoted context implies real facts; upgrade to clear validated statements with evidence. If critical facts are missing, say so briefly in REPLY and add crisp sub-bullets on what the founder must supply—never fabricate metrics or legal claims.`;

  const rolePreamble = guidanceOnly
    ? `You are the **Soul finpudsning** guide on Conduro — a **fresh session** after Grill-Me, with the same business. Your job is **validation & guidance**: move [HYPOTHESIS] and [UNKNOWN] toward clarity through **conversation** (like Grill-Me): focused questions, optional A) B) C) quick-pick lines in **Danish**. For **this** user message, **do not** rewrite or replace the stored markdown file.`
    : `You are a soul-document refinement assistant for Conduro. You may answer questions or, when asked, output a **complete** updated soul markdown file.`;

  const instructionsBlock = guidanceOnly
    ? `## Instructions — **guidance only** (ingen fil-ændring i denne tur)

1. Brug soul-dokumentet, sektionsoversigten og Grill-Me-digest til kontekst — **opfind ikke** fakta som allerede er afkræftet eller mangler i kilden.
2. Svar på **dansk**. Stil et eller få skarpe valideringsspørgsmål; peg på afsnit/markører ([HYPOTHESIS], [UNKNOWN — …]).
3. Når det passer, afslut med hurtigsvar-linjer **A) … B) … C) …** (evt. D)) som korte brugerbeskeder.
4. **Du må ikke** skrive linjen \`${REFINE_REPLY_SPLIT}\` eller levere hele soul-filen. Kun **REPLY:**-afsnittet nedenfor.
5. **Aldrig** foreslå at slette eller erstatte dokumentet med næsten tom tekst.

## Response format

REPLY:
<Din danske besked>`
    : `## Instructions — dokumentredigering tilladt når brugeren beder om det

1. Læs brugerens ønske. Ren **samtale/spørgsmål** → kun REPLY, **ingen** separator eller fil.
2. Når brugeren tydeligt vil have **ændret** markdown: lever **hele** det opdaterede dokument efter separator — bevar \`## N.\` / \`### N.\` nummererede sektioner og struktur. Udelad aldrig de fleste afsnit.
3. Output soul-markdown **præcis én gang**. Ingen dubletter af hele skabelonen.
4. Output aldrig en næsten tom fil.

## Response format

REPLY:
<kort bekræftelse, gerne dansk>

Hvis du har ændret dokumentet, tilføj præcis:

${REFINE_REPLY_SPLIT}
<fuldt opdateret markdown>

Brug kun separator når du leverer et komplet, sikkert dokument.`;

  const prompt = `${rolePreamble}

${profileNote}

## Grill-Me interview (forrige trin — samme virksomhed)

${grillDigest}

## Current soul document (editoren forstår overskrifter, lister, tabeller, code blocks — bevar mønstret)

\`\`\`markdown
${currentMarkdown.trim()}
\`\`\`
${gapSummary}${quoteSection}

## User request

${userMessage.trim()}

${instructionsBlock}`;

  const cursorApiKey = await getUserCursorApiKeyDecrypted();
  const stream = await runCursorAgent(
    prompt,
    mergeGrillMeCursorAgentOptions(cursorApiKey),
  );
  const raw = await collectStream(stream);

  function replyOnlyFromRaw(full: string): string {
    const idx = full.indexOf(REFINE_REPLY_SPLIT);
    const head = idx === -1 ? full : full.slice(0, idx);
    return head.replace(/^REPLY:\s*/i, "").trim() || full.trim();
  }

  if (guidanceOnly) {
    return { reply: replyOnlyFromRaw(raw), updatedMarkdown: null };
  }

  const splitIdx = raw.indexOf(REFINE_REPLY_SPLIT);

  if (splitIdx === -1) {
    const reply = raw.replace(/^REPLY:\s*/i, "").trim();
    return { reply: reply || raw.trim(), updatedMarkdown: null };
  }

  const replyPart = raw
    .slice(0, splitIdx)
    .replace(/^REPLY:\s*/i, "")
    .trim();
  let docPart = raw.slice(splitIdx + REFINE_REPLY_SPLIT.length).trim();
  if (docPart) {
    docPart = normalizeSoulMarkdownForEditor(docPart);
    if (isUnsafeSoulRefineOutput(currentMarkdown, docPart)) {
      return {
        reply: [replyPart, REFINE_UNSAFE_REPLY_DA].filter(Boolean).join("\n\n"),
        updatedMarkdown: null,
      };
    }
    await upsertBusinessSoulMarkdown(businessId, docPart);
  }

  return {
    reply: replyPart || "Done — the document has been updated.",
    updatedMarkdown: docPart || null,
  };
}
