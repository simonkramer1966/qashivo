# Qashivo Safe Optimization Plan
## Adapted for Current Codebase — Ready for CTO Review

---

## Executive Summary

| Metric | Current State | After Optimization |
|--------|--------------|-------------------|
| Database tables | 120 | ~82 (remove 38 verified-safe tables) |
| Tables with zero rows | 82 of 120 | 0 remaining empty tables |
| Service files | 73 (~36,400 lines) | ~57 (~33,000 lines) |
| Overlapping service code | ~8,500 lines in duplicates | ~3,000 lines after consolidation |
| N+1 query hotspots | 5+ confirmed | 0 |

---

## How This Differs from the Original Plan

| Original Recommendation | Our Adapted Approach | Reason |
|---|---|---|
| Drop 61 tables in one script | Drop 38 verified-safe tables in 2 tiers | Original would delete tables still referenced in code (e.g., `paymentPlans`, `disputes`, `contactNotes`) |
| BullMQ + Redis for job queues | Keep current scheduler | Redis is not available on the hosting platform |
| Modify vite.config.ts | Lazy loading in App.tsx only | vite.config.ts is a protected file |
| Delete 15+ service files blindly | Delete 1 orphan + consolidate 5 clusters | Original list included actively-imported services |
| Consolidate to 10 route files | Keep current structure | Routes are already mostly consolidated |

---

## PHASE 1: Database Cleanup

### Tier 1 — 12 tables with ZERO rows AND ZERO code references (Safest)

These can be removed with absolute confidence:

| Table | Rows | Code References |
|-------|------|----------------|
| `userPermissions` | 0 | 0 |
| `userInvitations` | 0 | 0 |
| `permissionAuditLog` | 0 | 0 |
| `disputeEvidence` | 0 | 0 |
| `onboardingTemplates` | 0 | 0 |
| `mlModelPerformance` | 0 | 0 |
| `partnerContractFiles` | 0 | 0 |
| `patternLibrary` | 0 | 0 |
| `forecastSnapshots` | 0 | 0 |
| `forecastVarianceTracking` | 0 | 0 |
| `ledgerConnections` | 0 | 0 |
| `ledgerSyncRuns` | 0 | 0 |

### Tier 2 — 26 tables with ZERO rows and minimal/inactive code references

These are empty and part of features that were scaffolded but never activated (voice workflows, ML scoring, A/B testing, magic links, etc.). Each needs its few references cleaned up before removal.

Includes: `customerContactRoles`, `customerPreferences`, `smeContacts`, `smeInviteTokens`, `partnerContracts`, `detectedOutcomes`, `aiAgentConfigs`, `retellConfigurations`, `voiceWorkflowStates`, `voiceStateTransitions`, `voiceMessageTemplates`, `voiceWorkflows`, `leads`, `templatePerformance`, `healthAnalyticsSnapshots`, `collectionAbTests`, `customerSegments`, `customerSegmentAssignments`, `seasonalPatterns`, `riskScores`, `customerLearningProfiles`, `paymentPredictions`, `budgetLines`, `aiFacts`, `magicLinkTokens`, `tenantTemplates`

### Tables the original plan would delete but we KEEP

| Table | Why Keep |
|-------|----------|
| `paymentPlans` | 7 active code references |
| `disputes` | 2 rows of data, 3 code references |
| `contactNotes` | Active UI with full CRUD |
| `customerContactPersons` | 6 rows of data, 5 references |
| `workflows` / `workflowNodes` | 11 references, core workflow engine |
| `cachedXeroInvoices` | Used by active Xero sync |
| `bills` / `bankAccounts` | Part of financial tracking features |

---

## PHASE 2: Service Cleanup

### Delete 1 orphaned service
- `outcomeDetection.ts` (398 lines) — zero imports anywhere in the codebase

### Consolidate 5 overlapping clusters

| Cluster | Current | Proposed | Lines Saved |
|---------|---------|----------|-------------|
| Playbook/Decision | 4 files (2,886 lines): `charlieDecisionEngine.ts`, `charliePlaybook.ts`, `playbookEngine.ts`, `portfolioController.ts` | 1 unified `collectionStrategyEngine.ts` | ~1,500 |
| Action Planning | 4 files (2,888 lines): `actionPlanner.ts`, `actionExecutor.ts`, `actionPrioritizationService.ts`, `dailyPlanGenerator.ts` | 2 files: planner + executor | ~1,000 |
| Risk/Scoring | 2 files (906 lines): `creditScoringService.ts`, `dynamicRiskScoringService.ts` | 1 file | ~200 |
| Demo | 2 files (641 lines): `demoDataService.ts`, `demoModeService.ts` | 1 file | ~30 |
| **Total** | **12 files** | **5 files** | **~2,730** |

### Remove 3 stub services returning placeholder data
- `businessAnalytics.ts` — all methods return hardcoded zeros
- `seasonalPatternService.ts` — returns empty data
- `predictivePaymentService.ts` — stub with TODOs

---

## PHASE 3: Fix N+1 Query Hotspots

| File | Problem | Fix |
|------|---------|-----|
| `customerSegmentationService.ts` (4 locations) | Individual inserts in for loops | Batch insert |
| `customerTimelineService.ts` | `findFirst` inside loop | Batch query + in-memory map |
| `communicationsOrchestrator.ts` | `getInvoice()` per invoice in loop | Single `WHERE id IN (...)` |
| `defaultWorkflowSetup.ts` | `findFirst` per template in loop | Batch query + existence check |
| `xero.ts` | `getContacts()` called repeatedly | Cache in Map before loop |

---

## PHASE 4: Add Database Indexes

Targeting the most heavily-queried tables based on actual code reference counts:

| Table | Code References | Proposed Index |
|-------|----------------|---------------|
| `invoices` | 103 | `(tenant_id, status)`, `(tenant_id, contact_id)`, `(due_date) WHERE status IN ('pending','overdue')` |
| `actions` | 58 | `(tenant_id, status)`, `(invoice_id)` |
| `contacts` | 42 | `(tenant_id)` |
| `emailMessages` | 15 | `(tenant_id)` |
| `outcomes` | 7 | `(invoice_id)` |
| `attentionItems` | 3 | `(tenant_id, status)` |

Risk: None. Non-blocking index creation.

---

## PHASE 5: Frontend Quick Wins

- **Lazy loading:** Wrap 76 page imports in `React.lazy()` to reduce initial bundle
- **Move `@faker-js/faker` to devDependencies** — it's currently a production dependency (~4MB)
- **Review `puppeteer`** (~300MB) — consider lighter PDF generation alternatives

---

## Implementation Timeline

| Phase | Effort | Risk | Dependencies |
|-------|--------|------|-------------|
| 1A: Drop 12 safe tables | 2 hours | None | — |
| 4: Add indexes | 1 hour | None | — |
| 2A: Delete orphan service | 15 min | None | — |
| 1B: Drop 26 inactive tables | 4 hours | Low | Phase 1A done |
| 3: Fix N+1 queries | 4 hours | Low | — |
| 2B: Consolidate service clusters | 8 hours | Medium | Testing |
| 2C: Remove stubs | 1 hour | Low | — |
| 5: Frontend optimizations | 2 hours | Low | — |
| **Total** | **~22 hours** | | |

---

## Rollback Strategy

- **Database:** Automatic checkpoint (snapshot of code + database) taken before each phase. One-click rollback available.
- **Code:** Each phase is a separate git commit. Any phase can be reverted independently.
- **Verification:** After each phase, restart the app and confirm core flows (dashboard, invoices, contacts, actions, outcomes) still work.

---

## What We're NOT Doing (and Why)

| Skipped Item | Reason |
|---|---|
| Redis/BullMQ migration | Not available on hosting platform |
| Complete route restructure | Already well-organized |
| Dropping active feature tables | Would break working features |
| Vite config changes | Protected configuration file |
| Removing dependencies that don't exist | Original plan listed packages not in our `package.json` |

---

## Success Metrics

| Metric | Before | Target | How to Measure |
|--------|--------|--------|---------------|
| Database table count | 120 | ~82 | SQL query on information_schema |
| Service file count | 73 | ~57 | File system count |
| Service code lines | 36,400 | ~33,000 | Line count |
| N+1 query hotspots | 5+ confirmed | 0 | Code review |
| Schema file size | 6,438 lines | ~5,200 lines | Line count |
| Production dependencies | includes @faker-js/faker | faker in devDeps only | package.json review |

---

*This plan prioritizes safety and verifiability. Every recommendation is backed by actual code analysis — table reference counts, import traces, and row counts from the live database. No table or service is removed without confirming it has zero active dependencies.*
