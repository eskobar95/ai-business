import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Core tenant — onboarding, memory, agents, teams attach here. */
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    githubRepoUrl: text("github_repo_url"),
    localPath: text("local_path"),
    /** Structured gap analysis JSON from Grill-Me reasoning phase (Prompt 1); drives chat interviewer. */
    grillReasoningContext: jsonb("grill_reasoning_context"),
    /** Last Prompt 1 failure message (shown in UI diagnostics). Cleared on success. */
    grillReasoningLastError: text("grill_reasoning_last_error"),
    grillReasoningUpdatedAt: timestamp("grill_reasoning_updated_at", { withTimezone: true }),
    /**
     * Onboarding wizard phase for this business:
     *   "grill_chat"   — Grill-Me interview in progress
     *   "grill_editor" — soul editor review in progress
     *   "complete"     — onboarding finished; soul persisted
     *   null           — not yet started (created outside onboarding wizard)
     */
    onboardingPhase: text("onboarding_phase").$type<"grill_chat" | "grill_editor" | "complete">(),
    /** Enterprise template lineage (ADR template provisioning). */
    templateId: text("template_id"),
    templateVersion: text("template_version"),
    derivedFromTemplateId: text("derived_from_template_id"),
    derivedFromTemplateVersion: text("derived_from_template_version"),
    /** True after enterprise template seed completes (dashboard one-click or CLI). */
    templateSeeded: boolean("template_seeded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("businesses_created_at_idx").on(t.createdAt)],
);

/** Per-user settings (e.g. encrypted Cursor API key). */
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    cursorApiKeyEncrypted: jsonb("cursor_api_key_encrypted"),
    cursorApiKeyIv: text("cursor_api_key_iv"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_settings_user_id_unique").on(t.userId)],
);

/** Platform-managed agent presets (soul/tools/heartbeat addenda). */
export const agentArchetypes = pgTable(
  "agent_archetypes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    soulAddendum: text("soul_addendum").notNull().default(""),
    toolsAddendum: text("tools_addendum").notNull().default(""),
    heartbeatAddendum: text("heartbeat_addendum").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_archetypes_slug_unique").on(t.slug)],
);

/** Platform-seeded orchestration behaviour (instructions + optional business memory injection). */
export const systemRoles = pgTable(
  "system_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    /** Base behavioural instructions appended before agent docs. */
    baseSystemPrompt: text("base_system_prompt").notNull(),
    /** When true, runners include business-scope memory markdown in prompts. */
    includeBusinessContext: boolean("include_business_context").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("system_roles_slug_unique").on(t.slug)],
);

/** Neon Auth user id (opaque string); links authenticated users to businesses. */
export const userBusinesses = pgTable(
  "user_businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_businesses_user_id_business_id_unique").on(t.userId, t.businessId),
    index("user_businesses_business_id_idx").on(t.businessId),
    index("user_businesses_user_id_idx").on(t.userId),
  ],
);

export const memoryScopeEnum = pgEnum("memory_scope", ["business", "agent"]);

/** CLI/runtime adapter for enterprise template agents (ADR execution_adapter). */
export const executionAdapterEnum = pgEnum("execution_adapter", [
  "hermes_agent_cli",
  "claude_code_cli",
  "cursor_agent_cli",
]);

/** Model routing strategy for LiteLLM vs Cursor-managed flows. */
export const modelRoutingEnum = pgEnum("model_routing", [
  "litellm_runpod",
  "cursor_managed",
  "cursor_allowlist",
]);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    archetypeId: uuid("archetype_id").references(() => agentArchetypes.id, {
      onDelete: "set null",
    }),
    systemRoleId: uuid("system_role_id").references(() => systemRoles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** Stable roster key from template shards (e.g. product_owner). */
    slug: text("slug"),
    /** Job / roster role label (distinct from DB role names). */
    role: text("role").notNull(),
    executionAdapter: executionAdapterEnum("execution_adapter"),
    modelRouting: modelRoutingEnum("model_routing"),
    /** 1 = lead, 2 = senior specialist, 3 = specialist (ADR tier). */
    tier: integer("tier"),
    /** Custom avatar image URL; takes priority over icon_key in UI when set. */
    avatarUrl: text("avatar_url"),
    /** Platform icon slug from the picker (e.g. bot, shield). Nullable when avatar_url is used. */
    iconKey: text("icon_key"),
    reportsToAgentId: uuid("reports_to_agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.reportsToAgentId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    uniqueIndex("agents_business_id_id_unique").on(t.businessId, t.id),
    uniqueIndex("agents_business_id_slug_unique").on(t.businessId, t.slug),
    index("agents_business_id_idx").on(t.businessId),
    index("agents_reports_to_agent_id_idx").on(t.reportsToAgentId),
    index("agents_archetype_id_idx").on(t.archetypeId),
    index("agents_system_role_id_idx").on(t.systemRoleId),
  ],
);

/** Markdown documents per agent (soul, tools, heartbeat, custom). */
export const agentDocuments = pgTable(
  "agent_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    filename: text("filename").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agent_documents_agent_id_slug_unique").on(t.agentId, t.slug),
    index("agent_documents_agent_id_idx").on(t.agentId),
  ],
);

/** Scheduled recurring prompts for an agent (cron + human label); runner invokes spawn post-MVP. */
export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    cronExpression: text("cron_expression").notNull(),
    humanSchedule: text("human_schedule").notNull(),
    prompt: text("prompt").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.businessId, t.agentId],
      foreignColumns: [agents.businessId, agents.id],
    }).onDelete("cascade"),
    index("routines_business_id_idx").on(t.businessId),
    index("routines_agent_id_idx").on(t.agentId),
    index("routines_is_active_next_run_at_idx").on(t.isActive, t.nextRunAt),
  ],
);

/** Markdown memory PARA-style; scoped to business-wide or agent-specific rows. */
export const memory = pgTable(
  "memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    scope: memoryScopeEnum("scope").notNull(),
    /** Markdown body. */
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("memory_business_id_idx").on(t.businessId),
    index("memory_agent_id_idx").on(t.agentId),
    index("memory_scope_idx").on(t.scope),
  ],
);

export const grillMeRoleEnum = pgEnum("grill_me_role", ["user", "assistant"]);

/** Grill-Me onboarding turns ordered per business. */
export const grillMeSessions = pgTable(
  "grill_me_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    role: grillMeRoleEnum("role").notNull(),
    content: text("content").notNull(),
    seq: integer("seq").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("grill_me_sessions_business_id_seq_unique").on(t.businessId, t.seq),
    index("grill_me_sessions_business_id_idx").on(t.businessId),
  ],
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("skills_business_id_idx").on(t.businessId)],
);

/** Files belonging to a skill (folder model). */
export const skillFiles = pgTable(
  "skill_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("skill_files_skill_id_path_unique").on(t.skillId, t.path),
    index("skill_files_skill_id_idx").on(t.skillId),
  ],
);

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agent_skills_agent_id_skill_id_unique").on(t.agentId, t.skillId),
    index("agent_skills_skill_id_idx").on(t.skillId),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    leadAgentId: uuid("lead_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    /** Template team key (e.g. product_team) for idempotent seeding. */
    slug: text("slug"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_business_id_id_unique").on(t.businessId, t.id),
    uniqueIndex("teams_business_id_slug_unique").on(t.businessId, t.slug),
    index("teams_business_id_idx").on(t.businessId),
    index("teams_lead_agent_id_idx").on(t.leadAgentId),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_members_team_id_agent_id_unique").on(t.teamId, t.agentId),
    index("team_members_agent_id_idx").on(t.agentId),
  ],
);

/** Human gate kinds seeded per business from enterprise templates. */
export const gateKinds = pgTable(
  "gate_kinds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    defaultMode: text("default_mode").notNull().$type<"blocking" | "warn_only">(),
    templateId: text("template_id"),
    templateVersion: text("template_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gate_kinds_business_id_slug_unique").on(t.businessId, t.slug),
    index("gate_kinds_business_id_idx").on(t.businessId),
  ],
);

/** Directed communication policy edges between agent roles (ADR §8). */
export const communicationEdges = pgTable(
  "communication_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    fromRole: text("from_role").notNull(),
    toRole: text("to_role").notNull(),
    direction: text("direction").notNull().$type<"one_way" | "bidirectional">(),
    allowedIntents: jsonb("allowed_intents").$type<string[]>().notNull(),
    allowedArtifacts: jsonb("allowed_artifacts").$type<string[]>().notNull(),
    requiresHumanAck: boolean("requires_human_ack").notNull().default(false),
    quotaPerHour: integer("quota_per_hour"),
    quotaMode: text("quota_mode").notNull().default("warn_only").$type<"warn_only" | "enforce">(),
    templateId: text("template_id"),
    templateVersion: text("template_version"),
    derivedFromTemplateId: text("derived_from_template_id"),
    derivedFromTemplateVersion: text("derived_from_template_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("communication_edges_business_from_to_unique").on(
      t.businessId,
      t.fromRole,
      t.toRole,
    ),
    index("communication_edges_business_id_idx").on(t.businessId),
  ],
);

/** RunPod lifecycle row for the orchestrator (single logical instance via `slug`). */
export const runpodInstanceStateEnum = pgEnum("runpod_instance_state", [
  "cold",
  "warming",
  "warm",
  "draining",
  "idle",
]);

export const runpodInstances = pgTable(
  "runpod_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().default("default"),
    state: runpodInstanceStateEnum("state").notNull().default("cold"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    endpointUrl: text("endpoint_url"),
    /** Fair-share queue cursor (last served tenant / business). */
    lastFairShareBusinessId: uuid("last_fair_share_business_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("runpod_instances_slug_unique").on(t.slug)],
);

export const agentJobStatusEnum = pgEnum("agent_job_status", [
  "queued",
  "inflight",
  "done",
  "failed",
]);

/** Orchestrator queue: one row per spawned agent job. */
export const agentJobs = pgTable(
  "agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    agentSlug: text("agent_slug").notNull(),
    adapter: executionAdapterEnum("adapter").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    status: agentJobStatusEnum("status").notNull().default("queued"),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    /** Optional consult edge attribution for quota checks. */
    fromRole: text("from_role"),
    toRole: text("to_role"),
    output: text("output"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("agent_jobs_business_id_status_idx").on(t.businessId, t.status),
    index("agent_jobs_status_enqueued_idx").on(t.status, t.enqueuedAt),
  ],
);

/** Business-scoped initiatives with PRD and sprint breakdown. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Markdown / rich-text PRD (aligned with Novel editor conventions). */
    prd: text("prd").notNull().default(""),
    /** draft | active | completed | archived */
    status: text("status").notNull().default("draft"),
    notionId: text("notion_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_business_id_idx").on(t.businessId),
    index("projects_status_idx").on(t.status),
  ],
);

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal"),
    /** planning | active | completed */
    status: text("status").notNull().default("planning"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sprints_project_id_idx").on(t.projectId)],
);

/** Encrypted MCP credentials library per business; agents opt in via `agent_mcp_access`. */
export const mcpCredentials = pgTable(
  "mcp_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    mcpName: text("mcp_name").notNull(),
    encryptedPayload: jsonb("encrypted_payload").notNull(),
    /** Base64-encoded IV / nonce for AES. */
    iv: text("iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mcp_credentials_business_id_mcp_name_unique").on(t.businessId, t.mcpName),
    uniqueIndex("mcp_credentials_business_id_id_unique").on(t.businessId, t.id),
    index("mcp_credentials_business_id_idx").on(t.businessId),
  ],
);

/** Agent opt-in to business-level MCP credentials. */
export const agentMcpAccess = pgTable(
  "agent_mcp_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull(),
    mcpCredentialId: uuid("mcp_credential_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.businessId, t.agentId],
      foreignColumns: [agents.businessId, agents.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.businessId, t.mcpCredentialId],
      foreignColumns: [mcpCredentials.businessId, mcpCredentials.id],
    }).onDelete("cascade"),
    uniqueIndex("agent_mcp_access_agent_id_mcp_credential_id_unique").on(
      t.agentId,
      t.mcpCredentialId,
    ),
    index("agent_mcp_access_business_id_idx").on(t.businessId),
    index("agent_mcp_access_agent_id_idx").on(t.agentId),
    index("agent_mcp_access_mcp_credential_id_idx").on(t.mcpCredentialId),
  ],
);

export const orchestrationStatusEnum = pgEnum("orchestration_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);

export const orchestrationEvents = pgTable(
  "orchestration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: orchestrationStatusEnum("status").notNull().default("pending"),
    correlationId: text("correlation_id"),
    correlationKey: text("correlation_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orchestration_events_business_id_idx").on(t.businessId),
    index("orchestration_events_status_idx").on(t.status),
    index("orchestration_events_correlation_id_idx").on(t.correlationId),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_business_id_idx").on(t.businessId),
    index("webhook_deliveries_status_idx").on(t.status),
    index("webhook_deliveries_type_idx").on(t.type),
  ],
);

export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactRef: jsonb("artifact_ref").notNull(),
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
    comment: text("comment"),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("approvals_business_id_id_unique").on(t.businessId, t.id),
    index("approvals_business_id_idx").on(t.businessId),
    index("approvals_agent_id_idx").on(t.agentId),
    index("approvals_approval_status_idx").on(t.approvalStatus),
  ],
);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "in_progress",
  "blocked",
  "in_review",
  "done",
]);

export const taskLogAuthorTypeEnum = pgEnum("task_log_author_type", ["agent", "human"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    teamId: uuid("team_id"),
    agentId: uuid("agent_id"),
    parentTaskId: uuid("parent_task_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("backlog"),
    priority: text("priority").default("medium"),
    labels: jsonb("labels").$type<string[]>().default([]),
    project: text("project"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    sprintId: uuid("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    storyPoints: integer("story_points"),
    blockedReason: text("blocked_reason"),
    approvalId: uuid("approval_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.businessId, t.teamId],
      foreignColumns: [teams.businessId, teams.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.businessId, t.agentId],
      foreignColumns: [agents.businessId, agents.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.businessId, t.parentTaskId],
      foreignColumns: [t.businessId, t.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.businessId, t.approvalId],
      foreignColumns: [approvals.businessId, approvals.id],
    }).onDelete("set null"),
    uniqueIndex("tasks_business_id_id_unique").on(t.businessId, t.id),
    index("tasks_business_id_idx").on(t.businessId),
    index("tasks_agent_id_idx").on(t.agentId),
    index("tasks_team_id_idx").on(t.teamId),
    index("tasks_parent_task_id_idx").on(t.parentTaskId),
    index("tasks_status_idx").on(t.status),
    index("tasks_project_id_idx").on(t.projectId),
    index("tasks_sprint_id_idx").on(t.sprintId),
  ],
);

export const taskLogs = pgTable(
  "task_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorType: taskLogAuthorTypeEnum("author_type").notNull(),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_logs_task_id_idx").on(t.taskId)],
);

export const taskRelations = pgTable(
  "task_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    fromTaskId: uuid("from_task_id").notNull(),
    toTaskId: uuid("to_task_id").notNull(),
    /** "blocks" | "blocked_by" | "related" */
    relationType: text("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("task_relations_from_idx").on(t.fromTaskId),
    index("task_relations_to_idx").on(t.toTaskId),
    index("task_relations_business_id_idx").on(t.businessId),
  ],
);

// --- Relations ---

export const businessesRelations = relations(businesses, ({ many }) => ({
  userLinks: many(userBusinesses),
  memories: many(memory),
  agents: many(agents),
  grillSessions: many(grillMeSessions),
  skillsMany: many(skills),
  teamsMany: many(teams),
  orchestrations: many(orchestrationEvents),
  webhookDeliveriesMany: many(webhookDeliveries),
  approvalsMany: many(approvals),
  mcpCredentialsMany: many(mcpCredentials),
  tasksMany: many(tasks),
  taskRelationsMany: many(taskRelations),
  projectsMany: many(projects),
  gateKindsMany: many(gateKinds),
  communicationEdgesMany: many(communicationEdges),
  agentJobsMany: many(agentJobs),
  routinesMany: many(routines),
}));

export const userSettingsRelations = relations(userSettings, () => ({}));

export const agentArchetypesRelations = relations(agentArchetypes, ({ many }) => ({
  agents: many(agents),
}));

export const systemRolesRelations = relations(systemRoles, ({ many }) => ({
  agents: many(agents),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  business: one(businesses, {
    fields: [projects.businessId],
    references: [businesses.id],
  }),
  sprintsMany: many(sprints),
  tasksMany: many(tasks),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, {
    fields: [sprints.projectId],
    references: [projects.id],
  }),
  tasksMany: many(tasks),
}));

export const userBusinessesRelations = relations(userBusinesses, ({ one }) => ({
  business: one(businesses, {
    fields: [userBusinesses.businessId],
    references: [businesses.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  business: one(businesses, {
    fields: [agents.businessId],
    references: [businesses.id],
  }),
  archetype: one(agentArchetypes, {
    fields: [agents.archetypeId],
    references: [agentArchetypes.id],
  }),
  systemRole: one(systemRoles, {
    fields: [agents.systemRoleId],
    references: [systemRoles.id],
  }),
  reportsTo: one(agents, {
    fields: [agents.reportsToAgentId],
    references: [agents.id],
    relationName: "agent_hierarchy",
  }),
  directReports: many(agents, { relationName: "agent_hierarchy" }),
  memories: many(memory),
  skillsLinks: many(agentSkills),
  leadOfTeams: many(teams),
  teamMemberships: many(teamMembers),
  documents: many(agentDocuments),
  mcpAccessRows: many(agentMcpAccess),
  approvals: many(approvals),
  tasksAssigned: many(tasks),
  routinesMany: many(routines),
}));

export const agentDocumentsRelations = relations(agentDocuments, ({ one }) => ({
  agent: one(agents, {
    fields: [agentDocuments.agentId],
    references: [agents.id],
  }),
}));

export const routinesRelations = relations(routines, ({ one }) => ({
  business: one(businesses, {
    fields: [routines.businessId],
    references: [businesses.id],
  }),
  agent: one(agents, {
    fields: [routines.agentId],
    references: [agents.id],
  }),
}));

export const memoryRelations = relations(memory, ({ one }) => ({
  business: one(businesses, {
    fields: [memory.businessId],
    references: [businesses.id],
  }),
  agent: one(agents, {
    fields: [memory.agentId],
    references: [agents.id],
  }),
}));

export const grillMeSessionsRelations = relations(grillMeSessions, ({ one }) => ({
  business: one(businesses, {
    fields: [grillMeSessions.businessId],
    references: [businesses.id],
  }),
}));

export const skillsRelations = relations(skills, ({ one, many }) => ({
  business: one(businesses, {
    fields: [skills.businessId],
    references: [businesses.id],
  }),
  agentLinks: many(agentSkills),
  files: many(skillFiles),
}));

export const skillFilesRelations = relations(skillFiles, ({ one }) => ({
  skill: one(skills, {
    fields: [skillFiles.skillId],
    references: [skills.id],
  }),
}));

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
  agent: one(agents, {
    fields: [agentSkills.agentId],
    references: [agents.id],
  }),
  skill: one(skills, {
    fields: [agentSkills.skillId],
    references: [skills.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  business: one(businesses, {
    fields: [teams.businessId],
    references: [businesses.id],
  }),
  leadAgent: one(agents, {
    fields: [teams.leadAgentId],
    references: [agents.id],
  }),
  members: many(teamMembers),
  tasks: many(tasks),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  agent: one(agents, {
    fields: [teamMembers.agentId],
    references: [agents.id],
  }),
}));

export const gateKindsRelations = relations(gateKinds, ({ one }) => ({
  business: one(businesses, {
    fields: [gateKinds.businessId],
    references: [businesses.id],
  }),
}));

export const communicationEdgesRelations = relations(communicationEdges, ({ one }) => ({
  business: one(businesses, {
    fields: [communicationEdges.businessId],
    references: [businesses.id],
  }),
}));

export const agentJobsRelations = relations(agentJobs, ({ one }) => ({
  business: one(businesses, {
    fields: [agentJobs.businessId],
    references: [businesses.id],
  }),
}));

export const mcpCredentialsRelations = relations(mcpCredentials, ({ one, many }) => ({
  business: one(businesses, {
    fields: [mcpCredentials.businessId],
    references: [businesses.id],
  }),
  agentAccessRows: many(agentMcpAccess),
}));

export const agentMcpAccessRelations = relations(agentMcpAccess, ({ one }) => ({
  business: one(businesses, {
    fields: [agentMcpAccess.businessId],
    references: [businesses.id],
  }),
  agent: one(agents, {
    fields: [agentMcpAccess.agentId],
    references: [agents.id],
  }),
  credential: one(mcpCredentials, {
    fields: [agentMcpAccess.mcpCredentialId],
    references: [mcpCredentials.id],
  }),
}));

export const orchestrationEventsRelations = relations(orchestrationEvents, ({ one }) => ({
  business: one(businesses, {
    fields: [orchestrationEvents.businessId],
    references: [businesses.id],
  }),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  business: one(businesses, {
    fields: [webhookDeliveries.businessId],
    references: [businesses.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one, many }) => ({
  business: one(businesses, {
    fields: [approvals.businessId],
    references: [businesses.id],
  }),
  agent: one(agents, {
    fields: [approvals.agentId],
    references: [agents.id],
  }),
  tasksLinked: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  business: one(businesses, {
    fields: [tasks.businessId],
    references: [businesses.id],
  }),
  team: one(teams, {
    fields: [tasks.teamId],
    references: [teams.id],
  }),
  agent: one(agents, {
    fields: [tasks.agentId],
    references: [agents.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "task_subtasks",
  }),
  subtasks: many(tasks, { relationName: "task_subtasks" }),
  approval: one(approvals, {
    fields: [tasks.approvalId],
    references: [approvals.id],
  }),
  projectLink: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  sprint: one(sprints, {
    fields: [tasks.sprintId],
    references: [sprints.id],
  }),
  logs: many(taskLogs),
  relationsFrom: many(taskRelations, { relationName: "task_relations_from" }),
  relationsTo: many(taskRelations, { relationName: "task_relations_to" }),
}));

export const taskLogsRelations = relations(taskLogs, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLogs.taskId],
    references: [tasks.id],
  }),
}));

export const taskRelationsRelations = relations(taskRelations, ({ one }) => ({
  business: one(businesses, {
    fields: [taskRelations.businessId],
    references: [businesses.id],
  }),
  fromTask: one(tasks, {
    fields: [taskRelations.fromTaskId],
    references: [tasks.id],
    relationName: "task_relations_from",
  }),
  toTask: one(tasks, {
    fields: [taskRelations.toTaskId],
    references: [tasks.id],
    relationName: "task_relations_to",
  }),
}));
