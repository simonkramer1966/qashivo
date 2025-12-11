# Qashivo Development Time Estimate

**Last Updated:** December 11, 2025

This document tracks the estimated equivalent human development time invested in building Qashivo.

---

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Total Source Files | ~1,350 |
| Total Lines of Code | ~306,000 |
| Custom Application Code | ~113,000 lines |

### Breakdown by Area

| Area | Files | Lines of Code |
|------|-------|---------------|
| Frontend Pages | 24 | 24,080 |
| Frontend Components | 174 | 42,758 |
| Server Services | 21 | 21,360 |
| Server Routes | 1 | 20,583 |
| Database Schema | 1 | 4,482 |
| Shared Types & Utilities | ~20 | ~5,000 |

---

## Time Breakdown by Feature Area

| Feature Area | Est. Hours | Est. Days | Description |
|--------------|-----------|-----------|-------------|
| **Database & Schema Design** | 40 | 5 | 50+ tables, multi-tenant B2B2B architecture, Drizzle ORM |
| **Authentication & RBAC** | 32 | 4 | Replit Auth, partner hierarchy, 50+ granular permissions |
| **Xero Integration** | 48 | 6 | OAuth 2.0 flow, sync engine, invoice/contact transformation |
| **Collections Automation** | 80 | 10 | Workflow engine, credit scoring, daily plan generation, scheduling |
| **AI/Voice Integration** | 56 | 7 | OpenAI intent analysis, Retell AI voice calls, sentiment detection |
| **Email/SMS Execution** | 32 | 4 | SendGrid email, Vonage SMS/WhatsApp integrations |
| **Action Centre UI** | 64 | 8 | Plan/VIP/Recovery tabs, drawers, previews, approval workflow |
| **Dashboard & Analytics** | 48 | 6 | Performance metrics, DSO trends, Tufte-style visualizations |
| **Debtor Self-Service Portal** | 40 | 5 | Magic link auth, Stripe payments, dispute handling, PTP tracking |
| **Settings & Admin Pages** | 32 | 4 | Partner admin, platform admin, automation policy settings |
| **UI Components & Styling** | 48 | 6 | Glassmorphism design system, 174 component files |
| **API Routes & Validation** | 56 | 7 | 20,500 lines of RESTful endpoints with Zod validation |
| **Testing & Debugging** | 40 | 5 | Integration testing, edge cases, bug fixes |
| **Architecture & Planning** | 24 | 3 | System design, documentation, technical decisions |

---

## Total Estimated Development Time

| Metric | Value |
|--------|-------|
| **Total Hours** | ~640 hours |
| **Total Days** (8-hour days) | ~80 days |
| **Total Weeks** (5-day weeks) | **~16 weeks** |
| **Total Months** (4-week months) | **~4 months** |

---

## Assumptions

This estimate assumes:
- A **senior full-stack developer** working solo
- Average velocity of ~50-75 lines/hour (accounting for complex business logic, third-party integrations, and debugging)
- Includes time for research, API documentation review, testing, and iteration
- Does not include project management, design work, or stakeholder meetings

---

## Complexity Factors

The following factors increase development complexity beyond typical CRUD applications:

1. **Multi-Tenant Architecture** - B2B2B model with partners, tenants, and users
2. **Third-Party Integrations** - Xero, SendGrid, Vonage, OpenAI, Retell AI, Stripe
3. **AI-Powered Features** - Intent analysis, sentiment detection, autonomous execution
4. **Voice Calling** - Real-time AI voice conversations with outcome tracking
5. **Financial Domain** - Collections workflows, credit scoring, interest calculations
6. **Role-Based Access Control** - 50+ permissions across partner/tenant/user hierarchy
7. **Real-Time Updates** - WebSocket connections for live execution monitoring

---

## AI Assistance Impact

Development was accelerated significantly through AI pair programming assistance. Estimated time savings:

| Without AI | With AI | Savings |
|------------|---------|---------|
| 16 weeks | ~5-6 weeks | **60-70%** |

---

## How to Update This Document

**Update Frequency:** Weekly or after major feature releases

**Commands to regenerate metrics:**

```bash
# Total lines of code
find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "./node_modules/*" | xargs wc -l | tail -1

# Count source files
find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "./node_modules/*" | wc -l

# Frontend pages
find ./client/src/pages -name "*.tsx" -exec wc -l {} + | tail -1

# Frontend components
find ./client/src/components -name "*.tsx" -exec wc -l {} + | tail -1

# Server services
find ./server/services -name "*.ts" -exec wc -l {} + | tail -1

# Server routes
wc -l ./server/routes.ts

# Schema
wc -l ./shared/schema.ts
```

**Update process:**
1. Run the commands above to get current metrics
2. Update the "Codebase Metrics" section with new values
3. Add new feature areas to the time breakdown if applicable
4. Update the "Last Updated" date at the top
5. Add an entry to the Version History table

---

## Version History

| Date | Update |
|------|--------|
| Dec 11, 2025 | Initial estimate created |
