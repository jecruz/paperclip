# Upstream Contributing Guide for jecruz/paperclip Fork

This document defines the rules and workflows for syncing this fork (`jecruz/paperclip`) with upstream (`paperclipai/paperclip`). Any agent or developer working in this repo must follow these guidelines.

## Repository Setup

| Remote | URL | Permission |
|--------|-----|------------|
| `origin` | `https://github.com/jecruz/paperclip.git` | Push allowed |
| `upstream` | `https://github.com/paperclipai/paperclip.git` | Fetch only (push DISABLED) |

**Canonical local repo:** `/Users/jeffreycruz/Development/AI_TOOLS/paperclip`

## Merge=Ours Strategy

`.gitattributes` forces local versions of conflict-prone files during upstream merges. These files contain fork-specific logic that must not be silently overwritten:

| File | Why Protected |
|------|---------------|
| `server/src/services/companies.ts` | Org reset/delete, CEO preservation, heartbeat toggle imports |
| `server/src/services/company-portability.ts` | Global agent defaults import logic |
| `ui/src/pages/CompanySettings.tsx` | Reset/delete confirmation UI |
| `ui/src/pages/CompanyImport.tsx` | Local directory import, global defaults form |
| `ui/src/lib/zip.ts` | pako DEFLATE support, local directory chunks |

After any upstream merge, manually review these files to cherry-pick relevant upstream changes into the local version. Do not blindly accept `merge=ours` without checking what upstream changed.

## Fork QoL Patches (not in upstream)

These are local modifications in the fork. If upstream overwrites these files, they must be re-applied:

### 1. Company Org Reset & Delete

New API endpoints and service logic for resetting or deleting a company org.

**Server changes:**
- `server/src/services/companies.ts` — `remove(id, confirmName)` with name verification; `reset(id, confirmName)` preserving CEO + board; `getCompanyById()` standalone function
- `server/src/routes/companies.ts` — `DELETE /:companyId` with confirm body; `POST /:companyId/reset`

**Shared types/validators:**
- `packages/shared/src/types/company.ts` — `CompanyResetDeletedCounts`, `CompanyResetRequest`, `CompanyResetResult`
- `packages/shared/src/validators/company.ts` — `companyResetRequestSchema`, `deleteCompanyRequestSchema`

**UI:**
- `ui/src/pages/CompanySettings.tsx` — Reset/delete confirmation dialogs
- `ui/src/api/companies.ts` — `reset()` and updated `remove()` with confirmName

**Key invariant:** `ne(agents.role, "ceo")` filter — the CEO agent must survive both reset and delete operations.

### 2. Local Directory Import & Global Agent Defaults

Import from local filesystem and apply default config to all imported agents.

**Types:**
- `packages/shared/src/types/company-portability.ts` — `CompanyPortabilityDefaultAgentConfig` (adapterType, model, command, extraArgs, parameters, maxTurnsPerRun, heartbeatEnabled, intervalSec)
- Added `defaultAgentConfig` field to `CompanyPortabilityPreviewRequest` and `CompanyPortabilityImportRequest`

**Server:**
- `server/src/services/company-portability.ts` — Three-layer config precedence: per-agent override > global defaults > manifest. Applies to adapter config and runtime config.

**UI:**
- `ui/src/pages/CompanyImport.tsx` — Source mode selector ("github" | "local" | "directory"), `readLocalDirectory()` via `window.showDirectoryPicker()`, expandable Global Agent Defaults form, test environment mutation
- `ui/src/lib/zip.ts` — `pako` import for DEFLATE decompression, `localChunks` handling

**Dependencies:**
- `ui/package.json` — added `pako`

### 3. Org-Level Heartbeat Enable/Disable Toggle

Company-level heartbeat kill switch that cascades to all agents.

**DB:**
- `packages/db/src/migrations/0053_quiet_cerebra.sql` — `heartbeats_enabled` boolean column default `true`
- `packages/db/src/schema/companies.ts` — `heartbeatsEnabled` field

**Server:**
- `server/src/services/heartbeat.ts` — `tickTimers()` checks `companyHeartbeatEnabled` map, skips agents in disabled companies

**UI:**
- `ui/src/pages/InstanceSettings.tsx` — `toggleOrgHeartbeatsMutation` cascades disable to all agents, optimistic cache updates

**Shared:**
- `packages/shared/src/types/company.ts` — `heartbeatsEnabled: boolean` on `Company`

### 4. CEO Preservation on Company Reset

- `server/src/services/companies.ts` — `ne(agents.role, "ceo")` filter in both `reset()` and `remove()`
- Board memberships preserved during reset (non-board memberships deleted)

### 5. Fork Infrastructure

- `.gitattributes` — merge=ours for 5 conflict-prone files (see table above)
- `CLAUDE.md` — project overview and tech stack

### 6. Post-Merge Bug Fixes

After any future upstream merge, check for and fix these common patterns:
- Missing `ne` import from `drizzle-orm`
- Missing table imports in `companies.ts` (routines, routineTriggers, routineRuns, labels, budgetPolicies, budgetIncidents, documents, documentRevisions, feedbackVotes, feedbackExports)
- `getCompanyById` being undefined at runtime (must be standalone, not inline arrow in service object)
- `cost_events` must be deleted before `heartbeat_runs` in the reset transaction
- Query cache invalidation after org reset (all company-scoped queries)
- `globalAgentConfig` and localStorage test compatibility

## Upstream Sync Workflow (importing changes FROM upstream)

### Step 1: Fetch upstream

```bash
cd /Users/jeffreycruz/Development/AI_TOOLS/paperclip
git fetch upstream
```

### Step 2: Review upstream commits

```bash
# See how many commits upstream is ahead
git log --oneline master..upstream/master | wc -l

# See how many local commits are ahead of upstream
git log --oneline upstream/master..master | wc -l

# Review the upstream commit list
git log --oneline master..upstream/master | head -30
```

Identify which upstream commits are relevant to the fork. Categorize:
- **Must take:** bug fixes, security patches, performance fixes
- **Nice to have:** features that don't conflict with fork modifications
- **Skip:** large refactors that would require re-applying all QoL patches

### Step 3: Choose merge strategy

**Full merge** (preferred when upstream is small and clean):
```bash
git merge upstream/master -m "Merge upstream paperclipai/master (sync with upstream)"
```

**Cherry-pick** (when you want specific commits only):
```bash
git checkout -b codex/cherrypick-upstream-$(date +%Y%m%d) master
git cherry-pick <sha1> <sha2> ...
# Validate, then merge back
git checkout master
git merge codex/cherrypick-upstream-$(date +%Y%m%d)
```

**Skip list** — defer these to a dedicated merge session:
- Large refactor PRs (e.g., type renames, schema restructures)
- Changes to files protected by `.gitattributes` merge=ours (review manually instead)
- Breaking API changes that would require updating fork-specific code

### Step 4: Validate

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

If any step fails, fix before proceeding. Common post-merge breakage:
- Missing imports (especially `ne` from drizzle-orm, new table imports)
- Type mismatches from upstream schema changes
- Test failures from changed API contracts

### Step 5: Verify local customizations survived

Check each fork feature area after the merge:

```bash
# CEO preservation filter still present
grep -n 'ne(agents.role, "ceo")' server/src/services/companies.ts

# Global agent defaults portability logic intact
grep -n 'normalizePortableProjectEnv\|extractPortableProjectEnvInputs' server/src/services/company-portability.ts

# Heartbeat toggle still filters by company
grep -n 'companyHeartbeatEnabled\|heartbeatsEnabled' server/src/services/heartbeat.ts

# .gitattributes still protects fork files
cat .gitattributes
```

If any check fails, re-apply the fork modification from the QoL patches list above.

### Step 6: Push to origin

```bash
git push origin master
```

## Upstream Contribution Workflow (sending changes TO upstream)

Follow upstream's `CONTRIBUTING.md` requirements:

### Small, focused changes

- One clear fix/improvement per PR
- Touch the smallest possible number of files
- All tests pass and CI is green
- Greptile score 5/5 with all comments addressed
- Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

### Bigger changes

1. Discuss in Discord #dev channel first
2. Include before/after screenshots for UI changes
3. Proof of manual testing
4. Greptile 5/5 with all comments addressed

### PR requirements (all PRs)

- **Thinking Path** — trace reasoning from project context to the change (examples in CONTRIBUTING.md)
- **What Changed** — bullet list of concrete changes
- **Verification** — how a reviewer can confirm it works
- **Risks** — what could go wrong
- **Model Used** — AI model that produced or assisted the change (provider, model ID, context window). Write "None — human-authored" if no AI.
- **Checklist** — all items checked

### Push and create PR

```bash
# Push to our fork (not upstream)
git push origin <topic-branch>

# Create PR from jecruz/paperclip:<topic-branch> to paperclipai/paperclip:master
gh pr create --repo paperclipai/paperclip --title "type(scope): description" --body "..."
```

## New Feature Branching Strategy

### Layer Model

| Layer | Where it lives | Why |
|---|---|---|
| Fork invariants | `jecruz/paperclip` fork (protected by `merge=ours`) | These are your deliberate deviations from upstream |
| New features | Branched from `upstream/master` | Rebase onto upstream cleanly, no divergence |
| Upstream contributions | Submit PR to `paperclipai/paperclip` | If a feature is upstream-quality, propose it upstream |

### New Features (don't depend on fork deviations)

New features that don't need fork-specific changes should be branched from `upstream/master`:

```bash
# Create new feature branch FROM upstream (not from your fork's HEAD)
git fetch upstream
git checkout -b feature/my-feature upstream/master

# Develop normally, rebase onto upstream/master periodically
git rebase upstream/master

# When ready: PR to upstream OR merge into fork branch
```

### Fork-Specific Features

Features that use fork-specific changes (defaultAgentConfig, confirmName, heartbeat toggle, etc.):
- Develop on `jecruz/paperclip` branches as before
- These are the ONLY branches that should diverge from upstream
- Future upstream syncs on these branches: `git merge upstream/master` — `.gitattributes` auto-protects fork files

### merge=ours Protection

The `.gitattributes` file auto-protects 5 fork-specific files during upstream merges:
- `server/src/services/companies.ts`
- `server/src/services/company-portability.ts`
- `ui/src/pages/CompanySettings.tsx`
- `ui/src/pages/CompanyImport.tsx`
- `ui/src/lib/zip.ts`

**DO NOT run `git merge -X ours`** — use the automatic `.gitattributes` merge strategy instead.

## Branch Naming

| Pattern | Purpose |
|---------|---------|
| `archived/<name>` | Old branches no longer actively developed |
| `codex/cherrypick-upstream-<date>` | Cherry-picking upstream commits |
| `codex/upstream-sync-<date>` | Reviewing upstream changes |
| `feature/<name>` | New features (branch from `upstream/master`) |
| `fix/<name>` | Bug fixes |

## Validation Commands

Run all three before claiming any sync is complete:

```bash
pnpm -r typecheck   # Type checking across all packages
pnpm test:run        # Run test suite
pnpm build           # Production build
```

## Fork Re-application Checklist

After every upstream merge, verify each item:

- [ ] `.gitattributes` exists with merge=ours for all 5 protected files
- [ ] `ne(agents.role, "ceo")` filter present in `companies.ts` reset/delete
- [ ] `CompanyResetDeletedCounts`, `CompanyResetRequest`, `CompanyResetResult` types exported from `@paperclipai/shared`
- [ ] `companyResetRequestSchema`, `deleteCompanyRequestSchema` validators exported from `@paperclipai/shared`
- [ ] `POST /:companyId/reset` route registered in `server/src/routes/companies.ts`
- [ ] `DELETE /:companyId` takes `confirmCompanyName` body
- [ ] `CompanyPortabilityDefaultAgentConfig` type with all fields (adapterType, model, command, extraArgs, parameters, maxTurnsPerRun, heartbeatEnabled, intervalSec)
- [ ] Global defaults three-layer precedence in `company-portability.ts`
- [ ] `pako` import in `ui/src/lib/zip.ts` and `pako` in `ui/package.json`
- [ ] `heartbeatsEnabled` column on companies table and `Company` type
- [ ] `companyHeartbeatEnabled` check in `heartbeat.ts` `tickTimers()`
- [ ] Toggle org heartbeats mutation in `InstanceSettings.tsx`
- [ ] Reset/delete confirmation dialogs in `CompanySettings.tsx`
- [ ] Source mode selector ("github" | "local" | "directory") in `CompanyImport.tsx`
- [ ] `readLocalDirectory()` via `window.showDirectoryPicker()` in `CompanyImport.tsx`
- [ ] Global Agent Defaults form in `CompanyImport.tsx`
- [ ] All validation commands pass: `pnpm -r typecheck && pnpm test:run && pnpm build`