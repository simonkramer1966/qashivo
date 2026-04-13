# QASHIVO — MVP v1.1 BUILD SPECIFICATION — PART 3

**Version:** 1.1.3 — 04 April 2026
**Scope:** Post-Sprint 8 — Action Centre, Dashboard evolution, email drawer, Riley hardening, two-way email, Working Capital Impact
**Reference:** MVP_V1.1_BUILD_SPEC.md (Sprints 5-8), CLAUDE.md (session log), CHARLIE_ENGINEERING_SPEC.md v1.2
**Prerequisite:** Sprints 5-8 complete, Charlie Engineering Gaps 1-14 implemented

---

## OVERVIEW

Sprints 5-8 delivered Xero production hardening, Data Health, Debtor Detail, Riley AI Assistant, and Weekly CFO Review. Part 3 covers the major UI/UX redesign and feature additions that followed:

1. **Action Centre** — complete redesign with tabbed structure, queue drawer, VIP management, exception triage
2. **Dashboard evolution** — debtor treemap, new metric cards, overdue toggle
3. **Email drawer redesign** — configure-first pattern with tone slider, LPI toggle, contact picker
4. **Riley hardening** — full page context injection, drawer awareness, URL-driven state
5. **Two-way email** — Gmail polling, Outlook placeholder, unified inbound processor
6. **Working Capital Impact** — baseline snapshots, DSO-driven impact tracking, Riley narratives
7. **Feature flags** — tenant-level flag system with admin panel for staged rollout
8. **Debtors list improvements** — sortable columns, fixed widths, standard row heights

---

## 1. ACTION CENTRE (Complete Redesign)

### 1.1 Tab Structure

```
Action Centre
├── Summary          — three-column control panel (default landing)
├── Queue (N)        — pending approvals with email preview drawer
├── VIP              — VIP debtor management
├── Activity         — recent agent actions log
├── Exceptions       — triage view with sub-tabs
│   ├── Collections  — collection-related exceptions
│   ├── Debtor Situations — debtor-level issues
│   └── Other        — uncategorised exceptions
```

### 1.2 Summary Tab

| Element | Detail |
|---------|--------|
| Layout | Three-column control panel: Queued / Actioned / Exceptions |
| Period selector | Filter by time range (Today, This Week, This Month, Custom) |
| Real-time refresh | Auto-refreshes counts and data on tab switch and navigation |
| Footer buttons | Aligned consistently across all three columns |
| Section headings | Consistent typography and spacing across columns |

### 1.3 Queue Tab

| Element | Detail |
|---------|--------|
| Right-hand drawer | Opens on row click — shows full email preview |
| Tone override | Slider in drawer with regenerate flow — user changes tone, clicks regenerate, new email generated |
| Defer | Duration picker — defer action by specified time period |
| Reject | Requires reason — rejection reason logged for Charlie learning |
| Keyboard shortcuts | Navigate queue, approve/reject without mouse |
| Three-dot menu | Per-row quick actions — stopPropagation on menu click |
| Run agent now | Visibility logic — only shown when conditions met (e.g., not in testing mode with no test contacts) |
| Column widths | Fixed — table-layout: fixed, no column jumping on data change |

### 1.4 VIP Tab

| Element | Detail |
|---------|--------|
| Promote to VIP | Requires reason text — stored for audit trail |
| Return to pool | Requires reason text — Charlie learns from both promotion and return |
| Charlie enforcement | VIP debtors never contacted by Charlie — enforced in actionPlanner.ts |
| Instant UI update | Optimistic update without page refresh (try/finally pattern to prevent UI freeze) |

### 1.5 Exceptions Tab

| Element | Detail |
|---------|--------|
| Sub-tab layout | Collections / Debtor Situations / Other — flow inline to the right |
| Triage view | Each exception shows: type, debtor, detail, suggested action |
| Exception config | Defined in shared/exceptionConfig.ts — type groupings into sub-tab categories |

### 1.6 Feature Flags

| Element | Detail |
|---------|--------|
| Implementation | Tenant-level feature flag system in shared/featureFlags.ts |
| Admin panel | UI for toggling flags per tenant — staged rollout control |
| Usage pattern | Wrap new features in flag checks — deploy code, enable per-tenant |

---

## 2. DASHBOARD EVOLUTION

### 2.1 Debtor Treemap

| Element | Detail |
|---------|--------|
| Library | Recharts, squarified layout algorithm |
| Container height | 640px fixed |
| Cell size | Variable — proportional to outstanding amount |
| Cell colour | Mapped to days overdue (green → amber → red gradient) |
| Cell content | Debtor name + percentage of total outstanding |
| Overdue toggle | "Show only overdue" — greys out current (not-yet-due) debtors |
| React fix | useCallback wrapper on treemap cell component (fixes React error #310) |

### 2.2 New Metric Cards (Row 2)

| Card | Source |
|------|--------|
| Unresolved exceptions | Exception count from exceptions table |
| Debtors in dispute | Contact count where dispute flag active |
| Debtors at legal stage | Contact count where agentToneLevel = 'legal' |
| Collected this month | Sum of payments received in current calendar month |

### 2.3 Existing Metric Cards (Row 1 — unchanged)

Total Outstanding, Total Overdue, DSO, Debtor Count (all via getARSummary()).

---

## 3. EMAIL DRAWER REDESIGN

### 3.1 Configure-First Pattern

The email drawer follows a "configure first, generate second" pattern — user sets all parameters before the LLM generates the email content. This prevents wasted generation cycles.

### 3.2 Drawer Elements

| Element | Detail |
|---------|--------|
| Tone slider | 5 snap positions: Friendly → Professional → Firm → Formal → Legal |
| LPI toggle | Late Payment Interest — toggle on/off with current calculated amount displayed |
| Riley brief | Free-text field — additional context for the LLM ("mention their recent order", "reference our call last week") |
| Contact picker | Three sections: Primary / Escalation / Other — checkboxes, multi-select |
| To field | Pre-populated with Primary AR Contact |
| Salutation | Uses selected contact's first name |
| Sign-off | Agent persona signature block |
| TEST MODE badge | Visible when tenant communicationMode = testing |
| Generate button | Triggers LLM generation with all configured parameters |

### 3.3 Contact Picker Detail

| Section | Behaviour |
|---------|-----------|
| Primary | Pre-selected, shows Primary AR Contact |
| Escalation | Shows Escalation Contact if set |
| Other | All other contacts for this debtor |
| Multi-select | Checkboxes allow CC to multiple contacts |

---

## 4. RILEY IMPROVEMENTS

### 4.1 Full Page Context Injection

| Enhancement | Detail |
|------------|--------|
| Route context | Current route path passed to Riley |
| Active tab | URL-driven tab state — Riley always knows which tab is active |
| Sub-tab | Active sub-tab (e.g., Exceptions > Collections) included |
| Drawer state | DrawerContext (global) — Riley knows when drawer is open and contents |
| Context narrative | buildContextNarrative() in rileyContextBuilder.ts assembles human-readable context string |

### 4.2 "Ask Riley" from Queue

When user clicks "Ask Riley" from a queue item, the chat pre-populates with full action context including: debtor name, invoice details, proposed tone, email content, and any relevant history.

### 4.3 Z-Index Fix

Riley floating chat widget z-index set above all drawers — always accessible even with drawer open.

### 4.4 Key File

`server/agents/rileyContextBuilder.ts` — page context assembly for Riley system prompt.

---

## 5. TWO-WAY EMAIL

### 5.1 Architecture

```
Inbound Email Sources
├── SendGrid inbound webhook (existing — token: qashivo-inbound-2026)
├── Gmail inbox polling (NEW — gmailPoller.ts)
├── Outlook polling (PLACEHOLDER — outlookPoller.ts)
│
↓ All sources normalise to common format
│
Unified Inbound Processor (processNormalizedInboundEmail)
├── Match to debtor (replyToken or email address)
├── Intent extraction via Claude (intentAnalyst)
├── Signal creation (customerBehaviorSignals + contactOutcomes)
├── Promise-to-pay → forecastUserAdjustments chain
├── Agent contextual reply generation
├── Compliance → approval flow → delivery via wrapper
└── Threading (In-Reply-To/References via emailMessages)
```

### 5.2 Gmail Polling

| Element | Detail |
|---------|--------|
| Service | server/services/gmailPoller.ts |
| Mechanism | OAuth-authenticated polling of connected Gmail inbox |
| Frequency | Configurable polling interval |
| Processing | Normalised emails passed to processNormalizedInboundEmail |

### 5.3 Outlook Polling

| Element | Detail |
|---------|--------|
| Service | server/services/outlookPoller.ts |
| Status | Placeholder — architecture defined, implementation deferred |
| Mechanism | Will use Microsoft Graph API for inbox polling |

### 5.4 Integrations Page Update

Email tab on Integrations page updated to show:
- SendGrid connection status
- Gmail OAuth connection and polling status
- Outlook placeholder with "Coming soon"

### 5.5 Promise-to-Pay Chain

Verified end-to-end: inbound email → intent extraction (95% confidence PTP detection) → forecastUserAdjustments entry created → appears in Weekly CFO Review inflow scenarios.

---

## 6. WORKING CAPITAL IMPACT

### 6.1 Purpose

Quantifies the financial value Qashivo has delivered — "working capital released" measured as DSO improvement × average daily revenue. Critical for: customer retention, case studies, and bank buyer due diligence.

### 6.2 Schema

```
tenantImpactSnapshots
├── id (PK)
├── tenantId (FK)
├── snapshotType: "baseline" | "30_day" | "90_day" | "scheduled"
├── dso: decimal
├── avgDailyRevenue: decimal
├── totalOutstanding: decimal
├── totalOverdue: decimal
├── workingCapitalReleased: decimal (calculated)
├── rileyNarrative: text (AI-generated summary)
├── createdAt
```

### 6.3 Snapshot Schedule

| Trigger | Type | Detail |
|---------|------|--------|
| First Xero sync | baseline | Captures starting position — the "before" snapshot |
| 30 days post-baseline | 30_day | First impact measurement |
| 90 days post-baseline | 90_day | Meaningful trend data |
| Weekly (ongoing) | scheduled | Continuous tracking for trend analysis |

### 6.4 Working Capital Released Calculation

```
workingCapitalReleased = (baselineDSO - currentDSO) × avgDailyRevenue
```

Where avgDailyRevenue = total invoiced amount over trailing 90 days ÷ 90.

### 6.5 Impact Report Page

| Element | Detail |
|---------|--------|
| Route | /qollections/impact |
| Content | Baseline vs current DSO, working capital released, trend chart, Riley narrative |
| Riley narrative | AI-generated per snapshot — explains what drove the change |

### 6.6 Integration Points

| Integration | Detail |
|-------------|--------|
| Dashboard | Metric card showing working capital released |
| Weekly CFO Review | Impact section included in Riley's weekly analysis |
| Riley proactive | Notifications triggered at 30-day and 90-day milestones |

### 6.7 Key File

`server/services/impactSnapshotService.ts` — snapshot creation, calculation, Riley narrative generation.

---

## 7. DEBTORS LIST IMPROVEMENTS

| Enhancement | Detail |
|-------------|--------|
| Sortable columns | Click column header to sort A-Z / Z-A or ascending/descending amount |
| Dual-sort | Outstanding and Overdue columns support sort on same header |
| Fixed column widths | table-layout: fixed — prevents column jumping on sort/filter |
| Standard row height | Consistent across all list views (Debtors, Data Health, Queue, Activity) |
| Back button | Uses window.history.back() for natural browser navigation |
| Scroll position | Preserved on navigation — returning to list remembers scroll position |
| Tab counts | Badge counts only shown when > 0 (no "Queue (0)" clutter) |

---

## 8. FIXES AND HARDENING

### 8.1 Xero Health Check

**Fix:** Removed org info verification call that was failing despite syncs running successfully. Health check now uses token refresh + invoice call only. Resolves misleading "Error" badge on Integrations page.

### 8.2 VIP Promotion UI Freeze

**Fix:** try/finally pattern ensures UI state always updates even on API error. Previously, failed VIP promotion/return left UI in frozen state.

### 8.3 React Error #310

**Fix:** useCallback wrapper on debtor treemap cell renderer component. React was re-creating cell components on every render, causing reconciliation errors.

### 8.4 Debtor Detail 500 Error

**Fix:** Schema migration issue — missing column causing server error on debtor detail page load.

### 8.5 Action Centre Summary Refresh

**Fix:** Summary tab now refreshes data on tab switch and on navigation back to Action Centre. Previously showed stale counts.

---

## KNOWN REMAINING ISSUES

| Issue | Detail | Priority |
|-------|--------|----------|
| VIP query mismatch | VIP tab shows "No VIP debtors" after successful promotion — likely `isVip` column name mismatch between mutation and query | High |
| Riley API key | "Sorry, I had trouble" in production — ANTHROPIC_API_KEY may not be set in Railway env vars | High |
| Compliance over-aggressive | 33 compliance failures — engine may be flagging legitimate content, needs threshold review | Medium |
| Ageing analysis chart | Wrong aging buckets on Dashboard — flagged March 2026, still unresolved | Medium |
| Portal link placeholder | {{PORTAL_LINK}} unfilled in email templates — needs removing from LLM prompts | Medium |
| Data Health bounces | Doesn't detect hard bounces from timeline events — only checks static contact fields | Low |
| Circuit breaker SMS | Admin SMS alerts silently fail — no phone column on users table | Low |

---

## ARCHITECTURE PRINCIPLES (Do Not Break)

These are load-bearing conventions. Violating any of them will cause data corruption, compliance failures, or security issues.

1. **AR calculations**: Always use `getARSummary()` in `arCalculations.ts` — never inline SUM queries
2. **Outbound comms**: All channels go through central enforcement wrappers — wrappers fail closed on errors
3. **Xero API data**: Operational inference only — never feed into model training (March 2026 terms)
4. **Schema typo**: `useLatePamentLegislation` is baked in — do not correct
5. **New tenants**: Default to testing communicationMode
6. **VIP enforcement**: Charlie never contacts VIP debtors — enforced in actionPlanner.ts
7. **AR overlay fields**: arContactEmail, arContactPhone, arContactName, arNotes — never overwritten by sync
8. **Communications safety**: Five unprotected send paths were found and fixed — any new send path must go through the wrapper

---

## KEY FILES (Part 3 additions)

| File | Purpose |
|------|---------|
| shared/featureFlags.ts | All tenant-level feature flags |
| shared/exceptionConfig.ts | Exception type groupings into Action Centre sub-tabs |
| server/services/impactSnapshotService.ts | Working capital impact tracking + snapshot calculation |
| server/agents/rileyContextBuilder.ts | Page context assembly for Riley (route + tab + drawer) |
| server/services/gmailPoller.ts | Gmail inbox polling for two-way email |
| server/services/outlookPoller.ts | Outlook inbox polling (placeholder) |
| CHARLIE_ENGINEERING_SPEC.md v1.2 | Charlie handover document (updated from v1.1) |

---

## BUILD ORDER SUMMARY (Full MVP v1.1)

```
SPRINT 5:       Xero production hardening + Data Health + communication test mode
SPRINT 6:       Debtor Detail page + row navigation + three-dot menus
SPRINT 7:       Riley AI Assistant (chat widget, conversations, intelligence extraction)
SPRINT 8:       Weekly CFO Review (Qashflow tab, review generation)
CHARLIE GAPS:   All 14 gaps implemented (Gap 14 Phase 2 deferred to Open Banking)
PART 3:         Action Centre redesign + Dashboard treemap + email drawer + Riley hardening
                + two-way email + Working Capital Impact + feature flags + polish
```

**MVP v1.1 is complete when (extended from Part 2):**
1. ~~Xero syncs reliably with token auto-refresh~~ ✓
2. ~~Data Health shows debtor readiness with inline editing~~ ✓
3. ~~Debtor Detail page shows full profile with multi-contact management~~ ✓
4. ~~Riley available on every page as floating chat assistant~~ ✓
5. ~~Riley gathers business intelligence during onboarding and ongoing~~ ✓
6. ~~Weekly CFO Review generates and displays in Qashflow tab~~ ✓
7. ~~Communication test mode prevents accidental live sends~~ ✓
8. Action Centre provides full queue management with drawer preview ✓
9. Dashboard treemap visualises debtor portfolio by outstanding/overdue ✓
10. Email drawer supports configure-first generation with tone control ✓
11. Riley has full page context awareness including drawer state ✓
12. Two-way email processes inbound from SendGrid + Gmail ✓
13. Working Capital Impact quantifies value delivered ✓
14. Feature flags enable staged rollout per tenant ✓
15. Known remaining issues resolved (VIP query, Riley API key, compliance thresholds)

---

*This spec extends MVP_V1.1_BUILD_SPEC.md (Sprints 5-8). Read all three parts together for the complete implementation plan.*
*Part 1: MVP_V1_BUILD_SPEC.md (Sprints 0-4) — Foundation, first LLM email, autonomy, dashboard, intelligence*
*Part 2: MVP_V1.1_BUILD_SPEC.md (Sprints 5-8) — Xero hardening, Data Health, Riley, Weekly CFO Review*
*Part 3: This document — Action Centre, Dashboard evolution, email drawer, Riley hardening, two-way email, Working Capital Impact*
