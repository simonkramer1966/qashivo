# QASHIVO — FUNDTECH FUNDER TENANT SPECIFICATION

**Version:** 1.0 — 12 April 2026
**Purpose:** Demo funder account that has visibility across all tenants in the system
**Depends on:** Partner Portal Spec (Sections 15-20), Demo Data Seed Spec

---

## 1. OVERVIEW

FundTech is a demo invoice finance company configured as a funder-type partner account in Qashivo. It has visibility across every tenant in the system, demonstrating the funder portal's lending book dashboard, position management, underwriting workflow, and risk monitoring.

This serves two purposes:
- **Investec demo:** Shows what the funder portal looks like with a live book across multiple clients
- **Product validation:** Tests the funder portal with real multi-tenant data before the Investec relationship goes live

---

## 2. FUNDTECH PROFILE

| Field | Value |
|-------|-------|
| Firm name | FundTech Capital Limited |
| Partner type | funder |
| Partner tier | gold |
| Primary contact | Alex Morgan (demo user) |
| Website | fundtechcapital.co.uk |
| Phone | 020 7946 0123 |
| Status | active |

### 2.1 Funder configuration

```json
{
  "defaultInterestRate": 3.2,
  "facilityFeePerInvoice": 50,
  "advanceRate": 80,
  "retentionRate": 20,
  "maxFacilityPerClient": 500000,
  "minInvoiceAmount": 500,
  "maxInvoiceAge": 90,
  "concentrationLimit": 30,
  "disclosedFactoring": false
}
```

Confidential factoring by default — Charlie chases as the client's persona, not FundTech's. This matches the Investec model.

---

## 3. FUNDER USERS

| Name | Email | Role | Sees |
|------|-------|------|------|
| Alex Morgan | alex.morgan@fundtechcapital.co.uk | admin | All clients |
| Rachel Dunn | rachel.dunn@fundtechcapital.co.uk | credit_controller | All clients (assigned to all) |

---

## 4. TENANT VISIBILITY

FundTech has `partnerTenantLinks` to every tenant in the system. This is set up automatically:

- When a new tenant is created, a link to FundTech is created with status `active` and accessLevel `full`
- This happens in the seed script for the demo, and can be toggled off in production via a feature flag

For the demo, this means FundTech sees:
- **Datum Creative Media Limited** (Simon's live demo tenant)
- **Archivo Limited** (demo data seed tenant, if loaded)
- Any other tenants that exist in the system

### 4.1 Per-tenant facility setup

Each linked tenant gets a funder facility:

**Datum Creative Media Limited:**

| Field | Value |
|-------|-------|
| Facility limit | £100,000 |
| Current drawdown | £28,450 |
| Available headroom | £71,550 |
| Interest rate | 3.5% per month |
| Advance rate | 80% |
| Status | active |
| Approved at | 18 Mar 2026 |
| Next review | 30 Jun 2026 |

With 3 active funded positions (matching the existing Qapital Facility page data):

| Invoice | Debtor | Face value | Advanced | Days active | Status |
|---------|--------|-----------|----------|-------------|--------|
| INV-5208270 | Mentzendorff & Co | £10,203 | £8,162 | 24 | Collecting |
| INV-5208299 | Swatch UK Group | £6,723 | £5,378 | 17 | Collecting |
| INV-5208354 | Pay By Phone | £17,487 | £13,990 | 10 | Collecting |

**Archivo Limited (if demo data loaded):**

| Field | Value |
|-------|-------|
| Facility limit | £75,000 |
| Current drawdown | £0 |
| Available headroom | £75,000 |
| Interest rate | 3.2% per month |
| Advance rate | 80% |
| Status | active |
| Approved at | 1 Apr 2026 |
| Next review | 30 Sep 2026 |

No active funded positions yet — the Archivo cash gap scenario (Week 7-8) is designed to trigger a Bridge request that FundTech would see as a new application in their underwriting queue.

---

## 5. WHAT FUNDTECH SEES

### 5.1 Lending book dashboard

When Alex Morgan logs into FundTech's funder portal, the lending book shows:

| Metric | Value |
|--------|-------|
| Total deployed | £28,450 (Datum only, Archivo has no drawdown) |
| Active positions | 3 |
| Avg duration | 17 days |
| Interest accruing | £593 |
| Overdue positions | 0 |
| Default risk | £0 |

### 5.2 Client list

| Client | Facility | Drawn | Available | Active | Avg duration | Risk |
|--------|----------|-------|-----------|--------|-------------|------|
| Datum Creative Media | £100k | £28k | £72k | 3 | 17d | Green |
| Archivo Limited | £75k | £0 | £75k | 0 | — | — |

### 5.3 Risk heatmap

Three tiles for the three funded positions, all green (within expected collection windows).

### 5.4 Application queue

If Archivo triggers a Bridge request from their cash gap, it appears here as a pending application for FundTech to review. This demonstrates the full Qollections → Qashflow → Qapital → Funder underwriting loop.

### 5.5 Concentration analysis

With only Datum's three positions, concentration is:
- Mentzendorff: 29% of book (approaching 30% limit — triggers amber)
- Pay By Phone: 49% of book (exceeds 30% — triggers red alert)
- Swatch UK: 19% of book (healthy)

This creates a realistic concentration warning in the demo — FundTech has too much exposure to Pay By Phone relative to their book size.

### 5.6 Context switching

Alex can click "Datum Creative Media" in the client list and switch into Datum's full Qashivo — seeing debtors, agent activity, forecast, and Qapital from the client perspective. A "← FundTech Portal" breadcrumb appears to return.

---

## 6. FUNDER PORTAL SIDEBAR

When in the FundTech portal context:

```
🏦 FundTech Capital
   Funder Portal

   Lending Book
   Applications
   Concentration
   Settlements
   
   Settings
     Team
     Funder Config
     Collection Rules
```

When viewing a client (after context switch):

```
📋 Datum Creative Media    [← FundTech]

   Funded Positions
   Active (3)
   Settled
   Unfinanced
   Transaction History
   
   Facility Settings
```

---

## 7. SEED SCRIPT ADDITIONS

Add to the demo data seed script (`server/services/demoDataSeed.ts`):

```typescript
export async function seedFundTechPartner(): Promise<void> {
  // 1. Create partnerAccount for FundTech (type: 'funder')
  // 2. Create 2 partnerUsers (Alex Morgan admin, Rachel Dunn controller)
  // 3. Create partnerTenantLinks to ALL existing tenants
  // 4. Create funderFacilities for each linked tenant
  // 5. Create fundedPositions for Datum (3 active positions)
  // 6. Set concentration limits and funder config
}
```

This can run independently of the Archivo demo data seed — FundTech can be seeded even when only Datum exists.

### 7.1 Auto-linking new tenants

When `seedFundTechPartner` has been run (FundTech exists), any new tenant created should automatically get a `partnerTenantLink` to FundTech. This ensures FundTech always sees every tenant.

Implementation: add a hook in the tenant creation flow:
```typescript
// After creating a new tenant:
const fundTech = await getFundTechPartner();
if (fundTech) {
  await createPartnerTenantLink(fundTech.id, newTenant.id);
  await createDefaultFunderFacility(fundTech.id, newTenant.id);
}
```

This hook should be behind a feature flag (`FUNDTECH_AUTO_LINK=true`) so it only runs in demo/development environments.

---

## 8. PRODUCTION CONSIDERATIONS

FundTech is a demo construct. In production:
- The auto-linking hook is disabled (feature flag off)
- Real funders (Investec) are onboarded manually via admin
- Each client-funder relationship is established through the broker introduction, not automatically
- Facility terms are negotiated per-client, not defaulted

The FundTech seed data should be clearable independently:
```typescript
export async function clearFundTechPartner(): Promise<void> {
  // Remove in FK order: fundedPositions → funderFacilities 
  // → controllerAssignments → partnerTenantLinks 
  // → partnerUsers → partnerAccount
}
```

---

## 9. BUILD ORDER

1. **Create FundTech seed script** — partner account, users, links, facilities, positions
2. **Wire into existing seed flow** — can be called from CLI (`npm run seed:fundtech`)
3. **Auto-link hook** — behind feature flag for new tenant creation
4. **Funder portal pages** — these are the partner portal funder pages (Spec Sections 17.1-17.8) rendered with FundTech's data
5. **Funder sidebar** — as defined in Section 6 above

FundTech seeding should be possible before the full funder portal pages are built — the data model can exist even if the UI isn't ready. This means the funder portal development can be tested incrementally against real multi-tenant data.

---

*Specification version: 1.0 — 12 April 2026*
*Author: Simon Kramer / Claude*
*Status: Specification — awaiting approval*
*Dependencies: Partner Portal Spec (Sections 15-20), partnerAccounts table with partnerType field*
