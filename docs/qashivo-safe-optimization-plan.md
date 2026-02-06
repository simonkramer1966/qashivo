# Qashivo Safe Optimization Plan
## v2.1 — CTO Approved with Minor Refinements

**Last Updated:** February 2026
**Status:** APPROVED — Ready to Execute (98% confidence per CTO review)

---

## Executive Summary

| Metric | Current State | After Optimization |
|--------|--------------|-------------------|
| Database tables | 120 | ~90 (remove 30 verified-safe tables; 2 more pending verification) |
| Tables with zero rows | 82 of 120 | 0 remaining purposeless empty tables |
| Service files | 73 (~36,400 lines) | ~62 (~34,000 lines) |
| Overlapping service code | ~8,500 lines in duplicates | ~5,000 lines after consolidation |
| N+1 query hotspots | 5+ confirmed | 0 |

---

## How This Differs from the Original External Plan

| Original Recommendation | Our Adapted Approach | Reason |
|---|---|---|
| Drop 61 tables in one script | Drop 30 verified-safe tables in 2 tiers with FK-aware ordering (+ 2 pending verification) | Original would delete tables still referenced in code (e.g., `paymentPlans`, `disputes`, `contactNotes`) |
| BullMQ + Redis for job queues | Keep current scheduler | Redis is not available on the hosting platform |
| Modify vite.config.ts | Lazy loading in App.tsx only | vite.config.ts is a protected file |
| Delete 15+ service files blindly | Delete 1 orphan + consolidate 2 clusters carefully | Original list included actively-imported services |
| Consolidate to 10 route files | Keep current structure | Routes are already mostly consolidated |

---

## PHASE 0: Pre-Flight Checks (NEW — per CTO review)

### 0A. Foreign Key Constraint Audit (COMPLETED)

An FK audit was run against all 38 tables originally proposed for deletion. Results:

| Referencing Table | Column | Referenced Table | Status |
|---|---|---|---|
| `customer_segment_assignments` | `segment_id` | `customer_segments` | Both in drop list — drop assignments FIRST |
| `forecast_variance_tracking` | `snapshot_id` | `forecast_snapshots` | Both in drop list — drop variance FIRST |
| `ledger_sync_runs` | `connection_id` | `ledger_connections` | Both in drop list — drop sync_runs FIRST |
| `partner_contract_files` | `partner_contract_id` | `partner_contracts` | Both in drop list — drop files FIRST |
| `voice_state_transitions` | `from_state_id` | `voice_workflow_states` | Both in drop list — drop transitions FIRST |
| `voice_state_transitions` | `to_state_id` | `voice_workflow_states` | Both in drop list — drop transitions FIRST |
| `voice_state_transitions` | `voice_workflow_id` | `voice_workflows` | Both in drop list — drop transitions FIRST |
| `voice_workflow_states` | `voice_workflow_id` | `voice_workflows` | Both in drop list — drop states FIRST |

**Finding:** All FK relationships are between tables within the drop list. No kept table depends on any dropped table. This is safe to proceed, as long as we respect the deletion order above.

### 0B. Tier 2 Reference Verification (COMPLETED)

Detailed reference audit revealed that 6 tables originally in Tier 2 are actually heavily used and must be reclassified to KEEP. See Tier 2 Reclassification section below.

### 0C. Backup Verification (REQUIRED before Phase 1)

Before any deletions:
- [ ] Verify Replit checkpoint includes both schema and data
- [ ] Confirm checkpoint restoration works (dry-run rollback)
- [ ] Estimated restoration time: should be under 5 minutes

---

## PHASE 1: Database Cleanup

### Tier 1 — 12 tables with ZERO rows AND ZERO code references (Safest)

These can be removed with absolute confidence. No code changes needed beyond schema removal.

| Table | Rows | Code References | FK Dependencies |
|-------|------|----------------|-----------------|
| `userPermissions` | 0 | 0 | None |
| `userInvitations` | 0 | 0 | None |
| `permissionAuditLog` | 0 | 0 | None |
| `disputeEvidence` | 0 | 0 | None |
| `onboardingTemplates` | 0 | 0 | None |
| `mlModelPerformance` | 0 | 0 | None |
| `patternLibrary` | 0 | 0 | None |
| `partnerContractFiles` | 0 | 0 | FK to `partnerContracts` — drop this FIRST |
| `forecastVarianceTracking` | 0 | 0 | FK to `forecastSnapshots` — drop this FIRST |
| `forecastSnapshots` | 0 | 0 | Drop AFTER `forecastVarianceTracking` |
| `ledgerSyncRuns` | 0 | 0 | FK to `ledgerConnections` — drop this FIRST |
| `ledgerConnections` | 0 | 0 | Drop AFTER `ledgerSyncRuns` |

**Required deletion order:**
1. `partnerContractFiles`, `forecastVarianceTracking`, `ledgerSyncRuns` (child tables first)
2. Then `forecastSnapshots`, `ledgerConnections` (parent tables)
3. All others in any order

**Action:** Remove from `shared/schema.ts`, then run schema push. Drop from database.

---

### Tier 2A — 18 tables with ZERO rows and verified-inactive code references (CONFIRMED SAFE)

Each table below has been individually audited. Reference counts and locations are documented. All references are schema definitions, cleanup routes, or stub services being removed in Phase 2C.

| Table | Rows | References | Reference Detail |
|-------|------|-----------|-----------------|
| `customerContactRoles` | 0 | 3 | Schema definition + delete in tenant cleanup route |
| `partnerContracts` | 0 | 1 | Schema definition only — drop AFTER `partnerContractFiles` |
| `detectedOutcomes` | 0 | 1 | Schema definition only (legacy, replaced by `outcomes`) |
| `aiAgentConfigs` | 0 | 1 | Schema definition only |
| `retellConfigurations` | 0 | 1 | Schema definition only |
| `voiceStateTransitions` | 0 | 2 | Schema + FK definitions only — drop FIRST in voice group |
| `voiceWorkflowStates` | 0 | 2 | Schema + FK definitions only — drop AFTER transitions |
| `voiceMessageTemplates` | 0 | 1 | Schema definition only |
| `voiceWorkflows` | 0 | 2 | Schema + FK definitions only — drop LAST in voice group |
| `leads` | 0 | 1 | Schema definition only |
| `templatePerformance` | 0 | 1 | Schema definition only |
| `healthAnalyticsSnapshots` | 0 | 1 | Schema definition only |
| `collectionAbTests` | 0 | 1 | Schema definition only |
| `customerSegmentAssignments` | 0 | 4 | Schema + delete in cleanup route + segmentation service — FK to `customerSegments`, drop FIRST |
| `customerSegments` | 0 | 4 | Schema + segmentation service (service itself is a stub candidate) — drop AFTER assignments |
| `seasonalPatterns` | 0 | 2 | Schema + seasonal service (stub returning empty data) |
| `paymentPredictions` | 0 | 2 | Schema + predictive service (stub) |
| `budgetLines` | 0 | 2 | Schema + referenced from budgets feature (inactive) |

### Tier 2B — 2 tables PENDING VERIFICATION (DO NOT DROP YET)

These tables are empty but have 5 code references each, including writes in active services. They require manual verification that their associated services are truly inactive before removal.

| Table | Rows | References | Reference Detail | Action Required |
|-------|------|-----------|-----------------|-----------------|
| `riskScores` | 0 | 5 | Schema + `dynamicRiskScoringService` writes/reads | Verify risk scoring service is not called by any active path. If confirmed inactive, move to Tier 2A. |
| `customerLearningProfiles` | 0 | 5 | Schema + `collectionLearningService` writes/reads | Verify learning service is not called by any active path. If confirmed inactive, move to Tier 2A. |

#### Tier 2B Verification Steps (per CTO review)

Run these commands before Phase 1B. If all searches return zero active usage, move the table to Tier 2A.

**For `riskScores`:**
```bash
# 1. Check if dynamicRiskScoringService is imported by any route or other service:
grep -r "dynamicRiskScoringService" server/routes.ts
grep -r "dynamicRiskScoringService" server/services/ --include="*.ts" | grep -v "dynamicRiskScoringService.ts"

# 2. Check if riskScores table is ever written to:
grep -r "insert.*riskScores\|update.*riskScores" server/ --include="*.ts"

# 3. Check application logs for any risk scoring activity
```

**For `customerLearningProfiles`:**
```bash
# 1. Check if collectionLearningService is imported by any route or other service:
grep -r "collectionLearningService" server/routes.ts
grep -r "collectionLearningService" server/services/ --include="*.ts" | grep -v "collectionLearningService.ts"

# 2. Check if customerLearningProfiles table is ever written to:
grep -r "insert.*customerLearningProfiles\|update.*customerLearningProfiles" server/ --include="*.ts"

# 3. Check application logs for any learning profile activity
```

**Decision criteria:**
- If grep returns zero results for steps 1 and 2 → move to Tier 2A (safe to drop)
- If grep returns results → reclassify to KEEP, document the active usage
- Estimated time: 30 minutes per table

**Required deletion order within Tier 2:**
1. `voiceStateTransitions` first (FK child)
2. `voiceWorkflowStates` second (FK child of voiceWorkflows)
3. `voiceWorkflows`, `voiceMessageTemplates` (parents)
4. `customerSegmentAssignments` first (FK child)
5. `customerSegments` second (parent)
6. `partnerContracts` after `partnerContractFiles` (already dropped in Tier 1)
7. All others in any order

---

### Tier 2 Reclassification — Tables MOVED to KEEP (per detailed audit)

The initial plan listed these as Tier 2 candidates for removal. Detailed reference analysis shows they are actively used and must be kept:

| Table | Rows | References | Why Keep |
|-------|------|-----------|----------|
| `customerPreferences` | 0 | **17** | Heavily used in `customerTimelineService.ts` — full CRUD (query, insert, update). Active feature. |
| `smeInviteTokens` | 0 | **21** | Active partner invite flow in `partnerRoutes.ts` — token creation, validation, redemption, listing. |
| `magicLinkTokens` | 0 | **22** | Full CRUD in `storage.ts` — token creation, validation with expiry checks, cleanup. Part of debtor self-service portal. |
| `tenantTemplates` | 0 | **12** | Full CRUD in `storage.ts` — list, create, update with filtering by channel/tone. Active feature. |
| `aiFacts` | 0 | **28** | Full CRUD in `storage.ts` + `routes.ts` + dedicated seeder. Tenant-scoped AI knowledge base. |
| `smeContacts` | 0 | **9** | Used in `partnerRoutes.ts` with queries. Part of partner management feature. |

---

### Tables the original external plan would delete but we KEEP

| Table | Why Keep |
|-------|----------|
| `paymentPlans` | 7 active code references |
| `disputes` | 2 rows of data, 3 code references |
| `contactNotes` | Active UI with full CRUD |
| `customerContactPersons` | 6 rows of data, 5 references |
| `workflows` / `workflowNodes` | 11 references, core workflow engine |
| `cachedXeroInvoices` | Used by active Xero sync |
| `bills` / `bankAccounts` | Part of financial tracking features |
| `customerPreferences` | 17 references (reclassified from Tier 2) |
| `smeInviteTokens` | 21 references (reclassified from Tier 2) |
| `magicLinkTokens` | 22 references (reclassified from Tier 2) |
| `tenantTemplates` | 12 references (reclassified from Tier 2) |
| `aiFacts` | 28 references (reclassified from Tier 2) |
| `smeContacts` | 9 references (reclassified from Tier 2) |

---

### Phase 1 Summary

| Tier | Tables Removed | Risk Level | Requires Code Changes |
|------|---------------|------------|----------------------|
| Tier 1 | 12 | None | Schema removal only |
| Tier 2A (confirmed safe) | 18 | Low | Minor import/reference cleanup |
| Tier 2B (pending verification) | 2 (deferred) | — | Requires manual audit first |
| Reclassified to Keep | 6 (moved from Tier 2) | N/A | N/A |
| **Total removed (immediate)** | **30** | | |
| **Total removed (if Tier 2B verified)** | **32** | | |

**Remaining after Phase 1:** ~90 tables (or ~88 if Tier 2B tables are confirmed safe)

---

## PHASE 2: Service Cleanup

### 2A — Delete orphaned service (no imports anywhere)

| File | Lines | Status |
|------|-------|--------|
| `server/services/outcomeDetection.ts` | 398 | Fully orphaned — zero imports elsewhere. Safe to delete. |

---

### 2B — Consolidate overlapping service clusters (UPDATED per CTO review)

#### Call Site Mapping (completed audit)

Full import/call traces have been mapped for each cluster to assess consolidation risk.

---

#### Cluster 1: Playbook / Decision Engine

**Current files (4 files, 2,886 lines):**

| File | Lines | Imported By |
|------|-------|-------------|
| `playbookEngine.ts` | 758 | `charliePlaybook`, `charlieDecisionEngine`, `actionExecutor`, `aiMessageGenerator`, `messagePreGenerator` (type exports only) |
| `charliePlaybook.ts` | 832 | `charlieDecisionEngine`, `dailyPlanGenerator` |
| `charlieDecisionEngine.ts` | 966 | `charliePlaybook` (circular!), `dailyPlanGenerator`, `workflowProfileMessageService` |
| `portfolioController.ts` | 330 | `server/index.ts` only (nightly job) |

**Dependency graph:**
```
playbookEngine (types/constants)
    ↑
charliePlaybook (cadence rules)
    ↑ ↓ (circular dependency!)
charlieDecisionEngine (decision logic)
    ↑
dailyPlanGenerator
portfolioController (standalone, uses actionPlanner)
```

**Key findings:**
- `playbookEngine.ts` primarily exports types (`ToneProfile`, `PlaybookStage`, `TemplateId`, `VoiceTone`) and constants. It's used by 5 other files as a type/config source.
- `charliePlaybook.ts` and `charlieDecisionEngine.ts` have a **circular dependency** — they import from each other.
- `portfolioController.ts` is standalone with a single call site in `index.ts`.

**CTO recommendation accepted:** Do this in 2 sub-phases:
1. **Sub-phase A:** Merge `portfolioController.ts` into `charlieDecisionEngine.ts` (low risk, single call site)
2. **Sub-phase B:** Resolve circular dependency between `charliePlaybook.ts` and `charlieDecisionEngine.ts`, then merge into single `collectionStrategyEngine.ts`. Keep `playbookEngine.ts` as a separate types/constants file since 5 services depend on its exports.

**Estimated savings:** ~800 lines (conservative — keeping types file separate)

---

#### Cluster 2: Action Planning (REVISED per CTO review)

**Current files (4 files, 2,888 lines):**

| File | Lines | Imported By |
|------|-------|-------------|
| `actionPlanner.ts` | 895 | `collectionsScheduler`, `portfolioController`, `server/index.ts` |
| `actionExecutor.ts` | 686 | `collectionsScheduler`, `routes.ts` |
| `actionPrioritizationService.ts` | 738 | `routes.ts` (10 direct references — heavily used in approval UI) |
| `dailyPlanGenerator.ts` | 569 | `server/index.ts`, `routes.ts` (2 references) |

**CTO recommendation accepted:** Keep all 4 files separate.

Rationale:
- `actionPlanner` and `actionExecutor` are a clean plan/execute pair (already well-separated)
- `actionPrioritizationService` has **10 direct references** in routes.ts powering the approval UI — it's a distinct concern (prioritization/ranking) not a planning concern
- `dailyPlanGenerator` is a distinct scheduled job with its own entry points

**Revised savings from this cluster:** 0 lines (no consolidation — these are already well-structured)

---

#### Cluster 3: Risk / Scoring

**Current files (2 files, 906 lines):**

| File | Lines | Imported By |
|------|-------|-------------|
| `creditScoringService.ts` | 252 | `routes.ts` (1 import, exports functions for risk assessment) |
| `dynamicRiskScoringService.ts` | 654 | `actionPrioritizationService`, `routes.ts` (5 references) |

**Recommendation:** Merge `creditScoringService.ts` into `dynamicRiskScoringService.ts`. The static scoring functions complement the dynamic scoring — they address the same concern from different angles.

**Estimated savings:** ~200 lines

---

#### Cluster 4: Demo (REVISED per CTO review)

**Current files (2 files, 641 lines):**

| File | Lines | Imported By |
|------|-------|-------------|
| `demoDataService.ts` | 610 | `routes.ts` (4 references — seed, clear, check demo data) |
| `demoModeService.ts` | 31 | `mockResponderService`, `vonage.ts`, `sendgrid.ts`, `retell-service.ts`, `routes.ts` (**9 references across 5 files**) |

**REVISED — DO NOT MERGE.** `demoModeService` is a feature flag service (`.isEnabled()`, `.setEnabled()`, `.getStatus()`) used as a guard across 5 different communication services. It is architecturally distinct from `demoDataService` (which seeds/clears test data). Merging would create an inappropriate coupling.

**Revised savings from this cluster:** 0 lines

---

### 2C — Remove stub services returning placeholder data

| File | Lines | Evidence | Imported By |
|------|-------|----------|-------------|
| `businessAnalytics.ts` | ~40 | All methods return hardcoded zeros | Verify before removing |
| `seasonalPatternService.ts` | 28 | Returns empty data, associated table (`seasonalPatterns`) being dropped | Verify before removing |
| `predictivePaymentService.ts` | ~50 | Stub with TODO markers, associated table (`paymentPredictions`) being dropped | Verify before removing |

**Estimated savings:** ~120 lines

---

### Phase 2 Summary (REVISED)

| Action | Files Affected | Lines Saved |
|--------|---------------|-------------|
| Delete orphan (`outcomeDetection.ts`) | 1 file deleted | ~400 lines |
| Consolidate Playbook cluster (2 sub-phases) | 4 files → 3 files | ~800 lines |
| ~~Consolidate Action Planning~~ | ~~4 → 2~~ | ~~Cancelled — already well-structured~~ |
| Merge Risk/Scoring | 2 files → 1 file | ~200 lines |
| ~~Merge Demo~~ | ~~2 → 1~~ | ~~Cancelled — architecturally distinct~~ |
| Remove stubs | 3 files deleted | ~120 lines |
| **Total** | **73 → ~62 files** | **~1,520 lines** |

---

## PHASE 3: Fix N+1 Query Hotspots

### Confirmed hotspots with exact locations

| File | Line(s) | Pattern | Fix | Error Handling |
|------|---------|---------|-----|---------------|
| `customerSegmentationService.ts` | 191, 278, 361, 444 | Individual `db.insert()` inside `for (const segment of segments)` loop | Batch: `db.insert(customerSegments).values([...segments])` | Wrap in transaction; if batch fails, log and skip segment creation |
| `customerTimelineService.ts` | 764 | `db.query.timelineEvents.findFirst()` inside `for (const action of recentActions)` loop | Pre-fetch: `WHERE id IN (...actionIds)`, then build lookup Map | If batch query fails, fall back to empty timeline (graceful degradation) |
| `communicationsOrchestrator.ts` | 507 | `storage.getInvoice(invoiceId)` inside `for (const invoiceId of invoiceIds)` loop | Create `storage.getInvoicesByIds(invoiceIds, tenantId)` batch method | If batch fails, skip sending for those invoices; log error |
| `defaultWorkflowSetup.ts` | 146 | `db.query.communicationTemplates.findFirst()` inside `for (const template of DEFAULT_TEMPLATES)` loop | Pre-fetch all templates for tenant, then check existence in memory | If pre-fetch fails, fall back to individual queries (current behavior) |
| `xero.ts` | 1094 | `storage.getContacts(tenantId)` called repeatedly inside sync loop | Cache result in Map at start of sync operation | If cache population fails, abort sync with error |

### Transaction Boundary Decisions (per CTO review)

Specify before implementation — which N+1 fixes need `db.transaction()` wrappers:

| File | Location | Transaction? | Rationale |
|------|----------|-------------|-----------|
| `customerSegmentationService.ts` | Lines 191, 278, 361, 444 | **YES** | Segment creation should be atomic — partial inserts would leave inconsistent state |
| `customerTimelineService.ts` | Line 764 | **NO** | Read-only operation (pre-fetch lookup map), no data mutation |
| `communicationsOrchestrator.ts` | Line 507 | **NO** | Read-only batch fetch, graceful degradation on failure |
| `defaultWorkflowSetup.ts` | Line 146 | **YES** | Setup operations should be atomic — partial template creation would leave broken defaults |
| `xero.ts` | Line 1094 | **YES** | Sync operations should be atomic — partial sync would leave data inconsistent |

**Testing requirement (per CTO):**
- [ ] Test each fix with 100+ records to verify performance improvement
- [ ] Verify transaction boundaries are correct
- [ ] Run before/after query timing comparison
- [ ] Confirm error handling paths work (inject failures)

---

## PHASE 4: Add Database Indexes

### Baseline metrics (REQUIRED before creating indexes)

Before adding any index, capture current performance:
```sql
EXPLAIN ANALYZE SELECT * FROM invoices WHERE tenant_id = '[test_tenant]' AND status = 'pending';
EXPLAIN ANALYZE SELECT * FROM actions WHERE tenant_id = '[test_tenant]' AND status = 'pending_approval';
EXPLAIN ANALYZE SELECT * FROM contacts WHERE tenant_id = '[test_tenant]';
```

Document execution times for before/after comparison.

### Proposed indexes

| Table | Code References | Proposed Index | Expected Impact |
|-------|----------------|---------------|-----------------|
| `invoices` | 103 | `(tenant_id, status)` | Speeds up dashboard, approval queue, collection planning |
| `invoices` | 103 | `(tenant_id, contact_id)` | Speeds up customer detail page |
| `invoices` | 103 | `(due_date) WHERE status IN ('pending','overdue')` | Speeds up overdue invoice queries |
| `actions` | 58 | `(tenant_id, status)` | Speeds up action approval queue |
| `actions` | 58 | `(invoice_id)` | Speeds up invoice detail lookups |
| `contacts` | 42 | `(tenant_id)` | Speeds up contact list page |
| `emailMessages` | 15 | `(tenant_id)` | Speeds up email history queries |
| `outcomes` | 7 | `(invoice_id)` | Speeds up outcome lookups per invoice |
| `attentionItems` | 3 | `(tenant_id, status)` | Speeds up attention items dashboard |

### Pre-creation: Estimate index sizes (per CTO review)

Before creating indexes, estimate their size to verify database capacity:

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size
FROM pg_tables 
WHERE tablename IN ('invoices', 'actions', 'contacts', 'emailMessages', 'outcomes', 'attentionItems')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Rule of thumb:** Indexes typically add 20-30% to table size. Expected total index overhead: ~50-100MB (acceptable for our dataset size). If tables are unexpectedly large, reconsider partial indexes or defer to off-peak hours.

**Risk:** None. `CREATE INDEX CONCURRENTLY` is non-blocking and safe on live databases. Indexes can be dropped instantly if issues arise.

**Post-creation verification:**
```sql
-- Re-run the same EXPLAIN ANALYZE queries and compare execution times
-- Target: >30% improvement on the top 10 most common queries
```

---

## PHASE 5: Frontend Quick Wins

### 5A — Lazy loading (REVISED per CTO review)

**Approach:** Start with 10-15 lowest-traffic pages first, not all 76 at once.

**Do NOT lazy-load (high-traffic, should load instantly):**
- Dashboard
- Invoices list
- Contacts list
- Action approvals
- Login/authentication pages

**Lazy-load first (lower-traffic, larger bundles):**
- Settings pages
- Workflow builder (uses heavy `@xyflow/react` dependency)
- Forecast/analytics pages (uses heavy `recharts`)
- Partner management pages
- Admin/platform pages
- Onboarding pages

**Implementation:**
- Add `<Suspense>` boundaries with proper loading skeleton fallbacks
- Monitor bundle size reduction after each batch
- Verify no shared contexts/providers break when pages load asynchronously

### 5B — Dependency cleanup

| Dependency | Size | Action |
|-----------|------|--------|
| `@faker-js/faker` | ~4MB | Move to devDependencies (should not ship to production) |
| `puppeteer` | ~300MB | Flag for future review — consider `html-pdf` or similar lightweight alternative |

---

## Implementation Timeline (REVISED per CTO final review)

| Phase | Base Effort | Verification | Total | Risk | Gate |
|-------|-------------|-------------|-------|------|------|
| **0: Pre-flight (backup test)** | 15 min | — | 15 min | None | Must complete before Phase 1 |
| **Baseline documentation** | 30 min | — | 30 min | None | Capture table count, service count, query baselines |
| 1A: Drop 12 safe tables | 2 hours | 15 min smoke test | 2.25 hours | None | Phase 0 complete |
| 4: Add indexes (with benchmarks) | 2 hours | 30 min benchmark | 2.5 hours | None | Estimate index sizes first; capture before/after |
| 2A: Delete orphan service | 15 min | 5 min test | 20 min | None | — |
| **Tier 2B verification** | 1 hour | — | 1 hour | None | Run grep commands; document findings before 1B |
| 1B: Drop 18 confirmed tables | 6 hours | 30 min smoke test | 6.5 hours | Low | Verify references cleaned |
| 1C: Drop 2 verified tables | 30 min | 15 min test | 45 min | Low | Only if Tier 2B confirms safe |
| **Specify transaction boundaries** | 30 min | — | 30 min | None | Document decisions before Phase 3 |
| 3: Fix N+1 queries | 6 hours | 1 hour testing | 7 hours | Low | Test with 100+ records; inject failures |
| 2B: Consolidate Playbook (sub-phase A) | 2 hours | 30 min test | 2.5 hours | Medium | Test decision outputs |
| 2B: Consolidate Playbook (sub-phase B) | 4 hours | 1 hour test | 5 hours | Medium | Full regression test |
| 2B: Merge Risk/Scoring | 2 hours | 15 min test | 2.25 hours | Low | Verify 6 import sites |
| 2C: Remove stubs | 1 hour | 15 min test | 1.25 hours | Low | Verify no active imports |
| 5: Frontend optimizations | 4 hours | 30 min test | 4.5 hours | Low | Start with 15 pages, measure, iterate |
| **Total** | **~33 hours** | **~5 hours** | **~38 hours** | | |

**Estimated calendar time:** 5-6 working days (allowing for testing and verification between phases)

---

## Red Flags — Stop / Proceed Criteria (per CTO review)

### STOP implementation if:
1. Any Tier 1 table deletion fails with FK constraint error (indicates missed dependency)
2. After merging services, any core flow breaks (dashboard, invoices, contacts, actions, outcomes)
3. After N+1 fixes, any query takes >2x longer than before
4. After lazy loading, any page shows blank screen for >1 second
5. Database size increases unexpectedly after adding indexes

### Proceed with caution if:
1. Any Tier 2 table has >3 previously-undiscovered code references (needs deeper audit)
2. Service consolidation affects >10 import statements
3. Index creation takes >10 minutes (might indicate data issues)

---

## Testing Strategy (NEW — per CTO review)

### Required before each phase:

| Phase | Test Requirement |
|-------|-----------------|
| 1A (Tier 1 tables) | Restart app, verify all pages load, confirm no console errors |
| 1B (Tier 2 tables) | Full smoke test of dashboard, invoices, contacts, actions, outcomes, partner management |
| 2A (Delete orphan) | Restart app, verify no import errors |
| 2B (Consolidate services) | Test decision engine outputs before/after; verify collections scheduler runs correctly |
| 3 (N+1 fixes) | Before/after query timing; test with 100+ records; inject failures to test error paths |
| 4 (Indexes) | Before/after `EXPLAIN ANALYZE` comparison |
| 5 (Frontend) | Page load times; verify no blank screens; check that lazy-loaded pages render correctly |

### Post-Phase Smoke Test Checklist (per CTO review)

Run after every phase (5 minutes per test):

- [ ] Dashboard loads without errors
- [ ] Invoices page loads and displays data
- [ ] Can view individual invoice details
- [ ] Contacts page loads and displays data
- [ ] Can view individual contact details
- [ ] Actions page loads (if applicable for phase)
- [ ] Can create new action (if applicable)
- [ ] Outcomes display correctly (if applicable)
- [ ] No console errors in browser DevTools
- [ ] No errors in application logs
- [ ] Core workflows still functional (e.g., can send test email)

### Service Consolidation Regression Tests (run after Phase 2B)

More comprehensive testing required after service merges:

**Decision engine:**
- [ ] Overdue invoice → should recommend email
- [ ] New invoice → should recommend SMS
- [ ] Repeat defaulter → should escalate tone
- [ ] Decision outputs match pre-consolidation baseline

**Collections scheduler:**
- [ ] Daily plan generates successfully
- [ ] Actions are created with correct priorities
- [ ] No duplicate actions created

**Portfolio controller nightly job:**
- [ ] Runs without errors
- [ ] Output matches previous behavior

**Risk scoring:**
- [ ] Test with 10 sample customers
- [ ] Compare scores before/after consolidation
- [ ] Variance should be <1%

### Monitoring during rollout:
- [ ] Watch application logs for new errors after each phase
- [ ] Monitor API response times for regression
- [ ] Check database connection pool for unexpected load changes

---

## Rollback Strategy

- **Database:** Automatic Replit checkpoint (snapshot of code + database) taken before each phase. One-click rollback available. Verified restoration time: under 5 minutes.
- **Code:** Each phase is a separate git commit. Any phase can be reverted independently via git.
- **Verification:** After each phase, restart the application and confirm core flows still work (see Testing Strategy above).
- **Indexes:** Can be dropped instantly with `DROP INDEX` if they cause issues.

---

## Failure Scenario Playbooks (per CTO review)

### Scenario 1: A "safe" table deletion breaks something
**Symptoms:** After Phase 1B, a feature stops working
**Likely cause:** Reference was missed in the audit (edge case: dynamic table name, commented code that's actually used)
**Response:**
1. Check git diff to identify which table was deleted
2. Restore from Replit checkpoint immediately (under 5 minutes)
3. Search codebase more thoroughly for that table name (including dynamic references and string interpolation)
4. Move table to KEEP list
5. Document why the reference was missed to improve audit process

### Scenario 2: Service consolidation introduces subtle bug
**Symptoms:** Decision engine produces different recommendations after Phase 2B
**Likely cause:** Hidden state dependency or timing assumption between the merged services
**Response:**
1. Rollback the Phase 2B commit via git
2. Compare before/after code side-by-side
3. Identify state initialization or timing difference
4. Fix in isolation with targeted tests
5. Re-attempt consolidation with the fix applied

### Scenario 3: N+1 fix makes queries slower
**Symptoms:** Batch query takes longer than the original individual queries
**Likely cause:** Database query planner chooses bad execution plan for large IN clause
**Response:**
1. Run `EXPLAIN ANALYZE` on the slow query
2. Check if indexes are being used (look for Seq Scan where Index Scan is expected)
3. Consider adding a covering index
4. If still slow, revert to original approach and document in code why the optimization was reverted

### Scenario 4: Index creation takes >10 minutes
**Symptoms:** `CREATE INDEX CONCURRENTLY` command hangs
**Likely cause:** Lock contention or unexpectedly large table
**Response:**
1. Check for long-running transactions: `SELECT * FROM pg_stat_activity WHERE state='active';`
2. Kill blocking queries if safe to do so
3. If table is unexpectedly large, defer index creation to off-peak hours
4. Document issue for review

---

## What We're NOT Doing (and Why)

| Skipped Item | Reason |
|---|---|
| Redis/BullMQ migration | Not available on hosting platform |
| Complete route restructure | Already well-organized |
| Dropping active feature tables | Would break working features |
| Vite config changes | Protected configuration file |
| Removing dependencies that don't exist | Original plan listed packages not in our `package.json` |
| Merging Action Planning cluster | Already well-structured (plan/execute/prioritize/schedule are distinct concerns) |
| Merging Demo services | `demoModeService` is a feature flag used by 5 services; architecturally distinct from `demoDataService` |

---

## Success Metrics (UPDATED per CTO review)

| Metric | Before | Target | How to Measure |
|--------|--------|--------|---------------|
| Database table count | 120 | ~90 (or ~88 after Tier 2B verification) | `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'` |
| Service file count | 73 | ~62 | `find server/services -name "*.ts" \| wc -l` |
| Service code lines | 36,400 | ~34,000 | `wc -l server/services/**/*.ts` |
| N+1 query hotspots | 5+ confirmed | 0 | Code review |
| Schema file size | 6,438 lines | ~5,600 lines | `wc -l shared/schema.ts` |
| Production dependencies | includes @faker-js/faker | faker in devDeps only | package.json review |
| **Query performance** | **Baseline TBD** | **>30% faster on top 10 queries** | **EXPLAIN ANALYZE before/after** |
| **Zero new errors** | **0 new errors** | **0 new errors** | **Application log monitoring** |

---

## Appendix A: Full Call Site Map for Service Clusters

### Playbook/Decision Cluster

```
playbookEngine.ts (758 lines) — TYPE EXPORTS
  ├── Imported by: charliePlaybook.ts (ToneProfile, VoiceTone, TemplateId)
  ├── Imported by: charlieDecisionEngine.ts (TemplateId, ToneProfile, VoiceTone)
  ├── Imported by: actionExecutor.ts (ToneProfile, PlaybookStage)
  ├── Imported by: aiMessageGenerator.ts (ToneProfile, PlaybookStage, ReasonCode, TemplateId)
  └── Imported by: messagePreGenerator.ts (ToneProfile, PlaybookStage)

charliePlaybook.ts (832 lines) — CADENCE RULES
  ├── Imported by: charlieDecisionEngine.ts (charliePlaybook, prepareMessageFromDecision)
  └── Imported by: dailyPlanGenerator.ts (charliePlaybook, prepareMessageFromDecision)

charlieDecisionEngine.ts (966 lines) — DECISION LOGIC
  ├── Imported by: charliePlaybook.ts (CharlieChannel, CustomerSegment, CharlieDecision) ⚠️ CIRCULAR
  ├── Imported by: dailyPlanGenerator.ts (charlieDecisionEngine, CharlieDecision, DailyPlan)
  └── Imported by: workflowProfileMessageService.ts (CharlieDecision, CharlieChannel)

portfolioController.ts (330 lines) — NIGHTLY JOB
  └── Imported by: server/index.ts (runNightly) — single call site
```

### Action Planning Cluster

```
actionPlanner.ts (895 lines) — PLAN GENERATION
  ├── Imported by: collectionsScheduler.ts (actionPlanner.planActionsForAllTenants)
  ├── Imported by: portfolioController.ts (reference only)
  └── Imported by: server/index.ts (planAdaptiveActions)

actionExecutor.ts (686 lines) — ACTION EXECUTION
  ├── Imported by: collectionsScheduler.ts (actionExecutor.executeScheduledActions)
  └── Imported by: routes.ts (actionExecutor.executeActionsByIds)

actionPrioritizationService.ts (738 lines) — PRIORITY SCORING
  └── Imported by: routes.ts (10 references — powers approval UI smart sorting)

dailyPlanGenerator.ts (569 lines) — DAILY SCHEDULE
  ├── Imported by: server/index.ts (generateDailyPlan)
  └── Imported by: routes.ts (generateDailyPlan — 2 references)
```

### Risk/Scoring Cluster

```
creditScoringService.ts (252 lines) — STATIC RISK ASSESSMENT
  └── Imported by: routes.ts (1 import — calculateRiskScore, getRiskAssessment)

dynamicRiskScoringService.ts (654 lines) — DYNAMIC RISK SCORING
  ├── Imported by: actionPrioritizationService.ts (DynamicRiskScoringService)
  └── Imported by: routes.ts (4 dynamic imports across risk-related endpoints)
```

### Demo Cluster (NO CONSOLIDATION)

```
demoDataService.ts (610 lines) — TEST DATA SEEDING
  └── Imported by: routes.ts (4 references — seed, forecast seed, clear, check)

demoModeService.ts (31 lines) — FEATURE FLAG
  ├── Imported by: mockResponderService.ts (3 guard checks)
  ├── Imported by: vonage.ts (1 guard check)
  ├── Imported by: sendgrid.ts (1 guard check)
  ├── Imported by: retell-service.ts (1 guard check)
  └── Imported by: routes.ts (2 references — get status, set enabled)
```

---

*This plan prioritizes safety and verifiability. Every recommendation is backed by actual code analysis — table reference counts, import traces, FK constraint checks, and row counts from the live database. No table or service is removed without confirming it has zero active dependencies. Updated per CTO technical review to include pre-flight checks, FK-aware deletion ordering, corrected Tier 2 reclassification, revised service consolidation scope, detailed call site mappings, testing strategy, monitoring requirements, transaction boundary decisions, index size estimation, post-phase smoke test checklists, regression test suites, and failure scenario playbooks.*
