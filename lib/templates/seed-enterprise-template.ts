import { eq, sql } from "drizzle-orm";

import {
  agentDocuments,
  agents,
  businesses,
  communicationEdges,
  gateKinds,
  teamMembers,
  teams,
} from "@/db/schema";
import type { AppDb } from "@/lib/templates/db-types";
import { TemplateSeedError } from "@/lib/templates/template-errors";
import type { BundlePayload } from "@/lib/templates/zod-schemas";

export type SeedEnterpriseTemplateResult = {
  teams: number;
  agents: number;
  edges: number;
  gates: number;
};

/**
 * Idempotent seed: upserts agents, teams, memberships, gate kinds, and communication edges.
 * Caller must verify bundle integrity (`verifyAndParseBundle`) before invoking.
 *
 * Note: `getDb()` uses the Neon **HTTP** driver (`drizzle-orm/neon-http`), which does not
 * support Drizzle `db.transaction()`. To avoid setting business lineage when later upserts fail,
 * template lineage columns are updated **after** all seed upserts succeed.
 */
export async function seedEnterpriseTemplate(
  db: AppDb,
  businessId: string,
  bundle: BundlePayload,
): Promise<SeedEnterpriseTemplateResult> {
  const templateId = bundle.manifest.template_id;
  const templateVersion = bundle.manifest.template_version;

  const businessRow = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (businessRow.length === 0) {
    throw new TemplateSeedError(
      "BUSINESS_NOT_FOUND",
      `No business exists with id ${businessId}; refusing to seed template rows.`,
    );
  }

  const agentUpsertRows = await db
    .insert(agents)
    .values(
      bundle.shards.agents.map((agent) => ({
        businessId,
        slug: agent.agent_slug,
        name: agent.display_name,
        role: agent.role_summary,
        executionAdapter: agent.execution_adapter,
        modelRouting: agent.model_routing,
        tier: agent.tier,
        avatarUrl: null,
        iconKey: agent.icon_key ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [agents.businessId, agents.slug],
      set: {
        name: sql.raw("excluded.name"),
        role: sql.raw("excluded.role"),
        executionAdapter: sql.raw("excluded.execution_adapter"),
        modelRouting: sql.raw("excluded.model_routing"),
        tier: sql.raw("excluded.tier"),
        iconKey: sql.raw("excluded.icon_key"),
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: agents.id, slug: agents.slug });

  const agentIdBySlug = new Map(
    agentUpsertRows.filter((r) => r.slug).map((r) => [r.slug!, r.id]),
  );

  const documentRows = bundle.shards.agents.flatMap((ag) => {
    const aid = agentIdBySlug.get(ag.agent_slug);
    if (!aid) {
      throw new TemplateSeedError(
        "SEED_REFERENCE_MISSING",
        `Agent slug missing after upsert: ${ag.agent_slug}`,
      );
    }
    return ag.agent_documents.map((doc) => ({
      agentId: aid,
      slug: doc.slug,
      filename: doc.filename,
      content: doc.content,
    }));
  });

  if (documentRows.length > 0) {
    await db
      .insert(agentDocuments)
      .values(documentRows)
      .onConflictDoUpdate({
        target: [agentDocuments.agentId, agentDocuments.slug],
        set: {
          filename: sql.raw("excluded.filename"),
          content: sql.raw("excluded.content"),
          updatedAt: sql`now()`,
        },
      });
  }

  const teamValues = bundle.shards.teams.map((team) => {
    const leadId = agentIdBySlug.get(team.lead_agent_slug);
    if (!leadId) {
      throw new TemplateSeedError(
        "SEED_REFERENCE_MISSING",
        `Lead agent slug not found after upsert: ${team.lead_agent_slug}`,
      );
    }
    return {
      businessId,
      slug: team.team_slug,
      name: team.display_name,
      leadAgentId: leadId,
    };
  });

  const teamUpsertRows = await db
    .insert(teams)
    .values(teamValues)
    .onConflictDoUpdate({
      target: [teams.businessId, teams.slug],
      set: {
        name: sql.raw("excluded.name"),
        leadAgentId: sql.raw("excluded.lead_agent_id"),
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: teams.id, slug: teams.slug });

  const teamIdBySlug = new Map(
    teamUpsertRows.filter((r) => r.slug).map((r) => [r.slug!, r.id]),
  );

  const memberRows = bundle.shards.agents.map((agent) => {
    const teamId = teamIdBySlug.get(agent.team_slug);
    const agentId = agentIdBySlug.get(agent.agent_slug);
    if (!teamId || !agentId) {
      throw new TemplateSeedError(
        "SEED_REFERENCE_MISSING",
        `Team membership unresolved for agent_slug=${agent.agent_slug} team_slug=${agent.team_slug}`,
      );
    }
    return {
      teamId,
      agentId,
      sortOrder: agent.tier,
    };
  });

  await db
    .insert(teamMembers)
    .values(memberRows)
    .onConflictDoUpdate({
      target: [teamMembers.teamId, teamMembers.agentId],
      set: {
        sortOrder: sql.raw("excluded.sort_order"),
      },
    });

  const gateShard = bundle.shards.gates;
  await db
    .insert(gateKinds)
    .values(
      gateShard.gate_kinds.map((gate) => ({
        businessId,
        slug: gate.slug,
        label: gate.label,
        description: gate.description,
        defaultMode: gateShard.default_mode,
        templateId,
        templateVersion,
      })),
    )
    .onConflictDoUpdate({
      target: [gateKinds.businessId, gateKinds.slug],
      set: {
        label: sql.raw("excluded.label"),
        description: sql.raw("excluded.description"),
        defaultMode: sql.raw("excluded.default_mode"),
        templateId: sql.raw("excluded.template_id"),
        templateVersion: sql.raw("excluded.template_version"),
      },
    });

  await db
    .insert(communicationEdges)
    .values(
      bundle.shards.communication_policy.edges.map((edge) => ({
        businessId,
        fromRole: edge.from_role,
        toRole: edge.to_role,
        direction: edge.direction,
        allowedIntents: edge.allowed_intents,
        allowedArtifacts: edge.allowed_artifacts,
        requiresHumanAck: edge.requires_human_ack,
        quotaPerHour: edge.quota_per_hour ?? null,
        quotaMode: edge.quota_mode,
        templateId,
        templateVersion,
        derivedFromTemplateId: templateId,
        derivedFromTemplateVersion: templateVersion,
      })),
    )
    .onConflictDoUpdate({
      target: [communicationEdges.businessId, communicationEdges.fromRole, communicationEdges.toRole],
      set: {
        direction: sql.raw("excluded.direction"),
        allowedIntents: sql.raw("excluded.allowed_intents"),
        allowedArtifacts: sql.raw("excluded.allowed_artifacts"),
        requiresHumanAck: sql.raw("excluded.requires_human_ack"),
        quotaPerHour: sql.raw("excluded.quota_per_hour"),
        quotaMode: sql.raw("excluded.quota_mode"),
        templateId: sql.raw("excluded.template_id"),
        templateVersion: sql.raw("excluded.template_version"),
        derivedFromTemplateId: sql.raw("excluded.derived_from_template_id"),
        derivedFromTemplateVersion: sql.raw("excluded.derived_from_template_version"),
        updatedAt: sql`now()`,
      },
    });

  const lineageUpdate = await db
    .update(businesses)
    .set({
      templateId,
      templateVersion,
      derivedFromTemplateId: templateId,
      derivedFromTemplateVersion: templateVersion,
      templateSeeded: true,
    })
    .where(eq(businesses.id, businessId))
    .returning({ id: businesses.id });

  if (lineageUpdate.length === 0) {
    throw new TemplateSeedError(
      "BUSINESS_NOT_FOUND",
      `Business ${businessId} was not found when applying template lineage (concurrent delete?).`,
    );
  }

  return {
    teams: bundle.shards.teams.length,
    agents: bundle.shards.agents.length,
    edges: bundle.shards.communication_policy.edges.length,
    gates: bundle.shards.gates.gate_kinds.length,
  };
}
