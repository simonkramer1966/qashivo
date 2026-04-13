# Human Time Estimate — Today's Work (2 April 2026)

## What Was Accomplished Today

### 1. CHARLIE_ENGINEERING_SPEC.md v1.1 (Audit + Specification)
Full audit of the Charlie decision engine across 20+ service files, identifying 14 engineering gaps with detailed schema changes, implementation briefs, and verification queries.

### 2. Eleven Engineering Gaps Implemented
| Gap | Feature | Complexity |
|-----|---------|------------|
| Gap 1 | Feedback loop — three-tier effectiveness, payment attribution, adaptive EMA | New service, event bus integration, Xero sync hooks |
| Gap 2 | PRS Bayesian prior (k=3) + recency weighting (90-day decay) | Mathematical model, schema changes, population mean |
| Gap 3 | Portfolio Controller per-debtor urgency weighting | New calculation, schema columns, two consumer paths |
| Gap 5 | Tone escalation velocity cap + history tracking | 3 helper functions, significant payment override, tenant settings |
| Gap 6 | Cold start + Debtor Intelligence Enrichment | Companies House API client, credit scoring, segment priors, new table, new service |
| Gap 7 | P(Pay) log-normal distribution model | CDF/quantile math, seasonal adjustments, 4 caller updates, CFO review rewrite |
| Gap 8 | Dead letter handling + delivery confirmation | SendGrid custom args, webhook pipeline, retry logic (5m/30m) |
| Gap 10 | Pre-action 30-day statutory response window | Legal window job, resolution API (3 paths), validation gate integration |
| Gap 11 | Debtor channel preference hard overrides | Decision engine + action planner wiring, Riley extraction, UI source tracking |
| Gap 12 | Lightweight debtor grouping | New table, full CRUD API, post-planning tone consistency sweep |
| Gap 13 | Seasonal payment pattern integration | Riley extraction prompt, learned patterns (12mo+), mu shifts, 4 caller updates |

### 3. CHARLIE_TECHNICAL_ARCHITECTURE.docx (62KB)
Comprehensive 10-section technical architecture document. 23 source files read in full, 256 paragraphs, 5 tables, 68 headings. Accurate function names, file paths, formulas, and constants throughout.

---

## Human Time Estimates

### Spec & Audit: ~1 week (5 days)
- Reading and deeply understanding 20+ interconnected services: 2–3 days
- Identifying gaps, designing solutions, writing the spec: 2–3 days
- A senior engineer who already knows the codebase could do this faster; someone onboarding would take longer

### Engineering Implementation: ~6–8 weeks (30–40 days)
Per-gap estimates for a strong senior backend engineer:

| Gap | Estimate | Rationale |
|-----|----------|-----------|
| Gap 1 (feedback loop) | 3–4 days | New service, attribution logic, EMA math, event bus wiring, 3 tenant settings |
| Gap 2 (PRS Bayesian) | 2 days | Mathematical model + schema + population mean query + window recalc |
| Gap 3 (portfolio urgency) | 1–2 days | Calculation + schema columns + 2 consumer path reads |
| Gap 5 (velocity cap) | 2 days | 3 DB query helpers, override logic, 2 tenant settings, tone engine rewrite |
| Gap 6 (cold start + enrichment) | 4–5 days | Two-part feature: segment priors + Companies House API + credit scoring + AI summary |
| Gap 7 (log-normal P(Pay)) | 3–4 days | Log-normal CDF/quantile implementation, seasonal integration, 4 caller rewrites, CFO review |
| Gap 8 (delivery tracking) | 2–3 days | SendGrid custom args, webhook handler fix, retry logic, event bus wiring |
| Gap 10 (legal window) | 2–3 days | Background job, timeline events, resolution API, validation gate, Xero auto-clear |
| Gap 11 (channel prefs) | 2 days | Two enforcement paths (engine + planner), Riley extraction, UI source/notes |
| Gap 12 (debtor grouping) | 2–3 days | Schema, CRUD API, post-planning sweep, domain detection, Riley context |
| Gap 13 (seasonal patterns) | 2–3 days | Riley prompt extension, learned pattern detection, mu shifts, 4 caller updates |
| **Subtotal** | **~25–35 days** | |

Add ~30% for testing, debugging, and integration issues that arise in practice: **~33–45 days**

### Technical Architecture Document: ~1–2 weeks (5–8 days)
- Reading 23 source files with enough depth to extract accurate details: 2–3 days
- Writing a 62KB document with correct function names, formulas, and data flows: 3–5 days
- Iterating on structure and prose quality: 1–2 days

---

## Total Estimate

| Work Item | Human Time |
|-----------|------------|
| Spec & audit | 1 week |
| 11 gaps implemented | 7–9 weeks |
| Architecture document | 1–2 weeks |
| **Total** | **9–12 weeks** |

That's roughly **2–3 months of a senior engineer's full-time work**, assuming they already know the codebase well, don't get blocked on reviews, and don't have meetings.

For a less experienced engineer or someone onboarding to the codebase: 4–6 months.

For a team of 2–3 engineers splitting the gaps: ~4–6 weeks calendar time (but the same total person-days).

### What makes the AI output faster (but not always better)
- **Zero context-switching cost**: Reading 23 files in parallel, holding all details in working memory simultaneously
- **No meetings, no PRs, no reviews**: Code goes straight in with no approval cycle
- **Pattern matching at scale**: Recognising that Gap 7's 4 callers all need the same interface change, simultaneously
- **Writing speed**: The architecture document's 62KB of accurate prose would take days to draft and revise by hand

### What a human would do better
- **Integration testing**: Actually running the code, hitting edge cases, verifying database migrations work
- **Design challenges**: Debating whether the Bayesian k=3 prior is the right choice vs k=5 (domain expertise)
- **Stakeholder alignment**: Understanding which gaps matter most to the bank buyer vs the end user
- **Production hardening**: Load testing, monitoring, alerting — things that require running infrastructure
