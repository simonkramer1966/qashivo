# Demo Xero System — Technical Feedback

**Date:** 7 Feb 2026
**From:** Engineering
**Re:** Review of Demo Xero Integration files

---

## Summary

The concept is exactly right — realistic demo data that flows through our existing sync pipeline without needing a real Xero connection. The archetype model (SaaS, Construction, Retail, Manufacturing, Professional Services, Wholesale) with different payment behaviors is well designed and will be valuable for demos, sales calls, and internal testing.

The implementation as provided assumes a different architecture to what we've built. Below are the specific gaps and a proposed alternative approach.

---

## What Works Well

- **Business archetypes with distinct payment behaviors** — reliable (95% on-time), slow (40% late), mixed, struggling — gives us realistic scenarios for demonstrating collections automation, escalation logic, and cash flow forecasting
- **Xero API format accuracy** — correct date formats, UK VAT codes (OUTPUT2, INPUT2), proper invoice statuses, realistic UK addresses and phone numbers
- **Simulation features** — ability to create individual invoices, receive payments, and simulate N days of trading activity is exactly what we need for live demos
- **Interceptor pattern** — clean separation between demo and real tenants

---

## Issues With Current Implementation

### 1. Wrong integration point

Our Xero integration uses the **Universal API Middleware** pattern. All Xero calls go through `XeroProvider` (registered as an accounting provider via `apiMiddleware`). The provided code wraps raw `xero-node` client calls with standalone functions like `syncXeroInvoices()`.

**Impact:** The interceptor would bypass our entire middleware layer — auth handling, rate limiting, error standardisation, and audit logging would all be skipped for demo tenants.

**Fix:** The intercept check should happen inside `XeroProvider` methods (e.g. `syncInvoices()`, `syncContacts()`, `syncPayments()`). When a tenant is flagged as demo, return generated data instead of calling the Xero API. Everything downstream stays identical.

### 2. Duplicate type definitions

`xero-response-formats.ts` (344 lines) defines Xero API types that largely overlap with types we already have in:
- `shared/schema.ts` (our DB schema / Drizzle types)
- `server/services/xero.ts` (Xero response handling)

**Fix:** Reuse our existing types. Only add new type definitions if genuinely missing. A small `xero-demo-types.ts` file for demo-specific types (archetype config, generation options) is fine.

### 3. No multi-tenancy / partner hierarchy awareness

Our app has a three-tier model: **Platform → Partner → Business**. Accounting firms (partners) manage multiple client businesses. The demo system creates flat tenant IDs in memory with no relationship to our partner structure.

**Impact:** Demo companies won't appear in partner dashboards, won't respect RBAC, and can't be used to demonstrate the partner management experience.

**Fix:** Demo company creation should:
1. Create a real `tenant` record in our database with an `isDemo: true` flag
2. Optionally attach it to a partner (for partner demo scenarios)
3. The tenant then works exactly like any real tenant — dashboards, RBAC, collections, forecasting all work automatically

### 4. In-memory only — no persistence

Demo companies are stored in a `Map<string, DemoXeroCompany>` in server memory. Server restart = all demo data lost.

**Impact:** During a sales demo, if the server restarts (which Replit does on idle), the demo company and all its data disappear.

**Fix:** Since we're proposing that demo data flows through the normal sync pipeline (point 3 above), the data persists in PostgreSQL automatically. The generator only needs to produce the initial Xero-formatted payload; once synced, it's real database records.

### 5. Missing constant references

The file defines `UK_TAX_TYPES` and `UK_ACCOUNT_CODES` constants but the generator doesn't consistently reference them — some values are hardcoded as magic strings.

**Fix:** Minor cleanup — reference the constants throughout the generator.

---

## Proposed Alternative Approach

Keep the excellent archetype/generator concept, but wire it into our existing architecture:

### Architecture

```
DemoDataGenerator (new)
  └── Produces Xero-formatted JSON responses per archetype
  
XeroProvider (existing, small modification)
  └── if tenant.isDemo → return DemoDataGenerator output
  └── else → call real Xero API (unchanged)

Normal sync pipeline (unchanged)
  └── Processes Xero responses into our DB tables
  └── Dashboard, collections, forecasting all work automatically
```

### New components

| Component | Description |
|-----------|-------------|
| `server/services/demoDataGenerator.ts` | Generates realistic Xero-formatted responses per archetype. Adapted from `demoXeroCompany.ts` using our existing types. |
| `tenants.isDemo` column | Boolean flag on tenants table to identify demo tenants. |
| Demo API routes | Create/list/delete demo companies, simulate trading. Protected by platform admin middleware. |

### Modified components

| Component | Change |
|-----------|--------|
| `XeroProvider` | Add intercept check: if `tenant.isDemo`, return generated data instead of calling Xero API |
| Sync pipeline | No changes — demo data looks identical to real Xero data |

### What stays the same (no changes needed)

- Dashboard metrics
- Collections automation / workflow engine
- Cash flow forecasting
- Action centre
- Customer drawer / timeline
- All frontend components
- Partner management

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| DemoDataGenerator service (adapted from provided code) | 3-4 hours |
| Tenant isDemo flag + XeroProvider intercept | 1 hour |
| Demo management API routes | 1-2 hours |
| Testing end-to-end | 1 hour |
| **Total** | **6-8 hours** |

---

## Questions for Discussion

1. **Which archetypes do we want for launch?** The provided six (SaaS, Construction, Retail, Manufacturing, Professional Services, Wholesale) are comprehensive. Do we need all six, or should we start with 3-4?

2. **Should demo companies be pre-created at server startup**, or only created on-demand via the API? On-demand is simpler and avoids cluttering the database.

3. **Do we need a frontend demo management UI**, or are API routes sufficient for now? A simple admin panel component could be added later.

4. **Trading simulation scope** — the provided code simulates new invoices and payments. Should we also simulate inbound communications (emails, SMS) to demonstrate the intent analyst and conversation features?

---

## Next Steps

Once we agree on the approach, implementation can begin. The generator code from the provided files is solid and will be adapted (not rewritten) to work within our architecture.
