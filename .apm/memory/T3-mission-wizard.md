# T3 — Mission Kickoff Wizard: Task Log

**Date:** 2026-05-15  
**Branch:** `feat/mission-kickoff-wizard`  
**Quality gate:** Green

---

## Summary

Replaced the basic `MissionCreateForm` at `/dashboard/missions/new` with a 4-step guided wizard that captures mission type, name, goal, and acceptance criteria before creating a mission.

---

## Changes made

### 1. `db/schema.ts`
- Added `validationContract: text("validation_contract").notNull().default("")` to the `missions` table.
- Added `projectType: text("project_type").notNull().default("new_project")` to the `missions` table.

### 2. `drizzle/0024_black_thunderbird.sql` (generated)
- `ALTER TABLE "missions" ADD COLUMN "validation_contract" text DEFAULT '' NOT NULL;`
- `ALTER TABLE "missions" ADD COLUMN "project_type" text DEFAULT 'new_project' NOT NULL;`

### 3. `lib/missions/actions.ts`
- Extended `createMission` to accept optional `validationContract` and `projectType` fields.
- Both fields have safe defaults if not provided.
- `assertUserBusinessAccess` ownership check preserved.

### 4. `app/dashboard/missions/new/mission-wizard.tsx` (new)
- 4-step `"use client"` wizard component.
- Step 1: Project type card selector + mission name (min 3 chars).
- Step 2: Goal textarea (min 20 chars) + optional read-only business soul card (truncated to 300 chars).
- Step 3: Dynamic acceptance criteria list — type + Enter or click "+ Add"; removable pills; min 1 required.
- Step 4: Review summary (type badge, name, goal preview, criteria count) + "Create mission" button.
- Progress indicator (4 numbered dots + connector lines).
- State persists across back/forward navigation.
- Criteria serialized as markdown bullet list (`- criterion`) in `validationContract`.

### 5. `app/dashboard/missions/new/page.tsx`
- Replaced `MissionCreateForm` with `MissionWizard`.
- Fetches business soul from `memory` table (`scope='business'`, `agentId IS NULL`) server-side.
- Passes soul content as prop to the wizard.

### 6. `app/dashboard/missions/page.tsx`
- Updated empty state heading to "No missions yet".
- Updated body copy to "Start by creating your first mission. Your Product Owner will turn it into a sprint brief."
- Button label changed to "Create first mission".

### 7. Drizzle collision fix
- `drizzle/meta/0023_snapshot.json` had the same `id` as `0022_snapshot.json` (both were forked from 0021).
- Fixed by assigning a new UUID to 0023's snapshot and setting its `prevId` to 0022's `id`, re-forming a valid chain.

---

## Quality gates

- `npx tsc --noEmit --skipLibCheck` → **0 errors**
- `npm test -- --run` → **362/362 tests pass**
- Migrations applied cleanly to Neon (exit 0).
- `assertUserBusinessAccess` ownership check preserved in `createMission`.
- Wizard state does not reset on back navigation (all state held in parent `MissionWizard` component).
