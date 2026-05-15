---
name: worktree-code-review
description: Conduct a thorough professional code review of all changes made in a git worktree session. Use when a worktree build is complete and needs peer review — checks correctness, code quality, security, test coverage, and refactoring opportunities. Launches as a sub-agent with clean context; reads only the diff between the worktree branch and its base.
disable-model-invocation: true
---

# Worktree Code Review

Professional code review of everything built or changed inside a git worktree. Mirrors how a senior engineer reviews a colleague's pull request: structured, evidence-based, and actionable.

## When to apply

- A worktree session has finished and the Manager (or user) asks for a review before merging.
- You are a sub-agent spawned with a clean context window — you have **no knowledge** of what was built unless you read the diff yourself.

---

## Workflow

### 1. Orient yourself

```bash
# Confirm you are inside the correct worktree root
git rev-parse --show-toplevel
git status
git log --oneline -10
```

Identify:
- **Current branch** (the feature branch)
- **Base branch** (usually `main` — verify with `git remote show origin` or ask the user)

### 2. Collect the diff

```bash
# All files changed vs base
git diff main...HEAD --stat

# Full diff (read this carefully)
git diff main...HEAD
```

If the diff is very large (>1 000 lines), prioritise:
1. New files added
2. Modifications to core logic / business rules
3. Schema or API contract changes

### 3. Preflight checks

Run whatever the project has configured. Common options (use whichever apply):

```bash
npm test          # or pnpm test / vitest
npm run lint
npm run typecheck # or tsc --noEmit
npm run build
```

Record pass / fail for each. A failing preflight is a **Critical** finding that blocks approval.

### 4. In-depth analysis

Examine every changed file against the seven pillars:

| Pillar | Key questions |
|---|---|
| **Correctness** | Does it do what the task requires? Any bugs, off-by-ones, wrong conditions? |
| **Security** | Secrets in code? Unvalidated input at API boundaries? SQL injection, XSS? Auth checks missing? |
| **Maintainability** | Clear naming, small focused functions, no God objects? Would a new colleague understand it in 6 months? |
| **Readability** | Comments explain *why*, not *what*. Consistent style. No dead code or commented-out blocks. |
| **Efficiency** | N+1 queries? Unnecessary re-renders or recomputes? Large allocations in hot paths? |
| **Edge cases & error handling** | What happens on null/empty/zero input? Network failures handled? Errors surfaced to the user? |
| **Test coverage** | New logic covered by unit or integration tests? Happy path **and** failure paths tested? |

### 5. Project-specific checks (always apply in this workspace)

- **Server / Client boundary**: No DB or auth imports in `"use client"` files.
- **Schema changes**: Migration file present and reversible? `db:generate` + `db:migrate` pattern followed?
- **Secrets**: No hardcoded credentials. New env vars added to `.env.example`.
- **UUID PKs + UTC timestamps**: All new tables follow the convention.
- **Conventional Commits**: Commit messages follow `feat:`, `fix:`, `chore:` etc.
- **README**: New directories have a `README.md` explaining purpose and exports.

Skip this section when reviewing non-TypeScript/non-Next.js projects.

---

## Output format

Structure the review as follows:

```
## Code Review — <branch-name>

### Preflight
| Check | Result |
|---|---|
| Tests | ✅ PASS / ❌ FAIL |
| Lint | ✅ PASS / ❌ FAIL |
| Typecheck | ✅ PASS / ❌ FAIL |
| Build | ✅ PASS / ❌ FAIL |

### Summary
One paragraph: what was built, overall quality signal, and the verdict.

### Findings

#### 🔴 Critical — must fix before merge
- **[file:line]** Description. Why it matters.

#### 🟡 Improvement — strongly recommended
- **[file:line]** Description. Suggested approach.

#### 🔵 Refactor — clean-up opportunity
- **[file:line]** Description. Why it improves the codebase.

#### 💬 Nitpick — optional polish
- **[file:line]** Description.

### Verdict
**✅ Approved** / **🔄 Approve with follow-up** / **❌ Request changes**

If "Approve with follow-up": list concrete follow-up tasks with a one-line risk and expiry.
If "Request changes": list the Critical findings that must be resolved first.
```

---

## Tone and conduct

- Be precise: cite file and line numbers for every finding.
- Be constructive: propose a fix or alternative, not just a complaint.
- Be proportionate: distinguish blocking issues from polish; don't inflate the severity of nitpicks.
- Be thorough but efficient: skip obvious boilerplate; focus time on business logic, security, and data paths.

---

## Quick reference: severity guide

| Level | Use when |
|---|---|
| 🔴 Critical | Bug, security hole, data loss risk, failing test, broken build |
| 🟡 Improvement | Correctness concern, missing edge-case handling, no tests for important path |
| 🔵 Refactor | Duplication, poor naming, overly complex function that could be simplified |
| 💬 Nitpick | Style, minor naming preference, optional comment |

**Never** downgrade a security or data-loss issue to Improvement to soften the message.
