# QASHIVO — SECURITY POLICY

**Version:** 1.0 — 10 April 2026
**Owner:** Simon Kramer, Nexus KPI Limited
**Reviewed by:** Mike (CTO)
**Status:** Active — all code changes must comply

---

## PURPOSE

This document defines the security rules for the Qashivo codebase. Every Claude Code session must read this file before making changes. Any change that violates these rules must be rejected, flagged, and reverted.

This is a living document. Update it when new security measures are implemented or when the threat model changes.

---

## 1. SECRETS MANAGEMENT

### 1.1 Environment Variables Only

All secrets, API keys, tokens, and credentials must be stored as environment variables in Railway. Never in code, config files, comments, logs, or error messages.

**Current secrets (Railway env vars):**
- `ANTHROPIC_API_KEY` — Claude API access
- `SENDGRID_API_KEY` — Email delivery
- `VONAGE_API_KEY` / `VONAGE_API_SECRET` — SMS
- `RETELL_API_KEY` — Voice calls
- `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` — Xero OAuth
- `DATABASE_URL` — Neon PostgreSQL connection
- `SESSION_SECRET` — Express session signing
- `PROVIDER_TOKEN_ENCRYPTION_KEY` — AES-256-GCM key for token encryption at rest
- `STRIPE_SECRET_KEY` — Payment processing

**Rules:**
- Never hardcode any of the above values in source code
- Never log secret values — log the key name only (e.g. "ANTHROPIC_API_KEY is set" not the value)
- Never include secrets in error messages returned to the client
- Never commit `.env` files to git (verify `.gitignore` includes `.env*`)
- If a new secret is needed, add it to Railway and document it here

### 1.2 Client Bundle Safety

The Anthropic API key and all other server-side secrets must never appear in the frontend bundle.

**Rules:**
- All Claude/Anthropic SDK calls happen server-side only
- `vite.config.ts` must not expose server env vars via `define` or `import.meta.env`
- After every build, verify: `grep -rn "sk-ant\|SG\.\|ANTHROPIC_API_KEY\|XERO_CLIENT_SECRET\|DATABASE_URL" dist/public/` returns 0 matches
- If a frontend feature needs data from an external API, it must proxy through a server endpoint

---

## 2. TOKEN ENCRYPTION AT REST

### 2.1 Xero Tokens

Xero access tokens and refresh tokens are encrypted at rest using AES-256-GCM.

**Implementation:** `server/utils/tokenEncryption.ts`
- `tryEncryptToken(plaintext)` — encrypts before database write
- `tryDecryptToken(encrypted)` — decrypts after database read
- `decryptTenantTokens(tenant)` — convenience wrapper for tenant rows
- `isEncrypted(value)` — detects whether a value is already encrypted

**Rules:**
- Every code path that writes `xeroAccessToken` or `xeroRefreshToken` to the database must call `tryEncryptToken()` first
- Every code path that reads these fields from the database must call `tryDecryptToken()` or `decryptTenantTokens()` before using the value
- If `PROVIDER_TOKEN_ENCRYPTION_KEY` is not set, tokens fall back to plaintext with a startup warning — this is acceptable only in local development, never in production
- The encryption key must never be logged, committed, or shared with Claude Code sessions
- If a new token field is added to the schema (e.g. for QuickBooks, Sage), it must follow the same encrypt-on-write, decrypt-on-read pattern

**Write sites (encrypt before DB write):**
1. OAuth callback — `integrationRoutes.ts`
2. Legacy token refresh — `xero.ts`
3. Adapter token refresh — `XeroAdapter.ts`
4. Health check token persist — `xeroHealthCheck.ts`

**Read sites (decrypt after DB read):**
1. Health check tenant select — `xeroHealthCheck.ts`
2. Adapter getTenant — `XeroAdapter.ts`
3. Legacy refresh re-read — `xero.ts`
4. Manual sync tenant read — `integrationRoutes.ts`
5. Onboarding token read — `onboardingRoutes.ts`

### 2.2 Future Tokens

When integrating additional accounting platforms (QuickBooks, Sage), their OAuth tokens must follow the same encryption pattern. Create equivalent columns (e.g. `quickBooksAccessToken`, `quickBooksRefreshToken`) and wire them through `tryEncryptToken`/`tryDecryptToken`.

---

## 3. AUTHENTICATION & AUTHORISATION

### 3.1 Session-Based Auth

All API endpoints require authentication via `isAuthenticated` middleware unless explicitly public (e.g. webhook endpoints with their own verification).

**Rules:**
- Never create an authenticated endpoint without `isAuthenticated` middleware
- Never expose user data or tenant data without tenant-scoping (all queries must filter by `tenantId`)
- Session cookies must have `httpOnly`, `secure`, and `sameSite` flags set

### 3.2 Role-Based Access Control (RBAC)

Roles in order of privilege: `readonly` < `credit_controller` < `manager` < `admin` < `owner`

**Gated endpoints:**
| Minimum Role | Endpoints |
|-------------|-----------|
| `manager` | POST /api/xero/sync, POST /api/agent/run-now, POST /api/collections/scheduler/run-now, PUT /api/xero/sync/schedule |
| `admin` | POST /api/action-centre/create-test-items |
| `owner` | POST /api/demo-data/reset-all, POST /api/demo-data/reset-comms |

**Rules:**
- Any endpoint that triggers agent runs, sync operations, data mutations, or destructive operations must require minimum role of `manager`
- Any endpoint that creates test/demo data must require `admin`
- Any endpoint that resets or deletes production data must require `owner`
- Use `withRBACContext` + `withMinimumRole('role')` middleware pattern
- When adding new endpoints, always ask: "What is the minimum role that should access this?"

### 3.3 Tenant Isolation

Every database query must be scoped to the authenticated user's `tenantId`. Cross-tenant data access is a critical security violation.

**Rules:**
- Every `SELECT`, `UPDATE`, `DELETE` query that touches tenant data must include `WHERE tenantId = user.tenantId`
- Never trust client-supplied tenant IDs — always use the authenticated session's tenant
- Batch operations must verify all target records belong to the same tenant
- API responses must never include data from other tenants

---

## 4. RATE LIMITING

### 4.1 Current Limits

Defined in `server/middleware/rateLimits.ts`:

| Limiter | Rate | Window | Applied To |
|---------|------|--------|-----------|
| `syncRateLimit` | 3 requests | 15 minutes | POST /api/xero/sync |
| `agentRateLimit` | 3 requests | 5 minutes | POST /api/agent/run-now, POST /api/collections/scheduler/run-now |
| `destructiveRateLimit` | 5 requests | 15 minutes | POST /api/demo-data/reset-all, POST /api/demo-data/reset-comms |
| `mutationRateLimit` | 20 requests | 1 minute | POST /api/approval-queue/clear, POST /api/approval-queue/approve-all |

**Rules:**
- All rate limits are per-IP
- When adding new expensive or destructive endpoints, apply an appropriate rate limiter
- Rate limit responses return HTTP 429 with a clear message
- Never disable rate limiting in production

### 4.2 Future Additions

When the system is multi-tenant with public signup, add:
- Login: 5 attempts per 15 minutes per IP
- Registration: 3 attempts per hour per IP
- Password reset: 3 attempts per hour per email

---

## 5. XERO API COMPLIANCE

### 5.1 Data Usage

Xero's API terms (March 2026) prohibit using API data for AI/ML model training.

**Rules:**
- Qashivo's AI operates as inference on customer-owned data, never training on Xero data
- The CIE (Collective Intelligence Engine) must never store or process Xero-sourced data — only Qashivo's own operational data (outcomes, signals, timings)
- Invoice amounts in the CIE are converted to bands before storage (under_500, 500_2k, etc.) — never exact Xero amounts
- Open Banking data (when integrated) has no training restriction and can feed the CIE directly

### 5.2 Token Handling

Xero uses rotating refresh tokens — every successful refresh invalidates the previous token immediately.

**Rules:**
- All token refreshes must go through the shared process-wide lock in `server/services/xeroTokenLock.ts`
- Never refresh tokens from two independent code paths without coordination
- After acquiring the refresh lock, always re-read tokens from the database before refreshing (another caller may have already refreshed)
- The health check must verify API access with the existing token first and only refresh when actually expired
- Never rotate tokens just to "verify" the connection — use a lightweight API ping instead

### 5.3 Rate Limits

Xero API: 60 calls per minute, 5000 per day.

**Rules:**
- Sync pagination uses 1.5-second delay between pages
- 429 responses trigger a 60-second wait and retry
- Enrichment batches at 10 contacts with 15-second pauses

---

## 6. COMMUNICATION SAFETY

### 6.1 Outbound Communications

All outbound debtor communications (email, SMS, voice) go through central enforcement wrappers that fail closed.

**Rules:**
- Every outbound message must pass through the compliance engine
- New tenants default to `testing` communication mode — test addresses only
- CC recipients suppressed in test mode with a note in the email body
- Business hours enforced — no sends outside configured hours (approve outside hours → schedule for next opening)
- Communication mode must be explicitly changed by the user — never auto-promote from testing to live

### 6.2 Email Security

- ReplyTo addresses use tenant-specific tokens for routing
- From address: configurable via `SENDGRID_FROM_EMAIL`
- All outbound emails are LLM-generated — no templates with static content
- Email content is validated by the compliance engine before sending

### 6.3 Inbound Processing

- Inbound emails via SendGrid webhook must be verified (signature validation)
- Intent extraction runs on all inbound messages before any action is taken
- Promise detection requires minimum 0.85 confidence
- Borderline promises (0.85-0.92) require debtor confirmation

---

## 7. DATABASE SECURITY

### 7.1 Connection

- PostgreSQL on Neon serverless with SSL enforced
- Connection string in `DATABASE_URL` env var only
- Drizzle ORM prevents SQL injection via parameterised queries

### 7.2 Schema Changes

**Rules:**
- Always run `npm run db:push` against production after schema changes
- Schema changes that add NOT NULL columns without defaults will break production — always provide defaults
- Never delete columns that existing code reads without deploying the code change first
- The `onboardingComplete` flag must not be reset by schema migrations — the routing check should use data presence (does tenant have debtors?) as the primary signal

### 7.3 Data Protection

- AR overlay fields (arContactEmail, arContactPhone, arContactName, arNotes) are never overwritten by Xero sync — this is customer-curated data
- Cached Xero tables are disposable; enriched Qashivo tables are persistent
- The schema typo `useLatePamentLegislation` is preserved — baked into the schema, do not correct

---

## 8. WEBHOOK SECURITY

### 8.1 Xero Webhooks

- Xero webhook payloads should be verified using the webhook signing key
- Webhook endpoints do not require session auth (they use their own verification)
- Failed webhook processing must not expose internal errors to the caller

### 8.2 SendGrid Inbound Parse

- Inbound parse webhook should verify the SendGrid source
- Malformed or suspicious inbound emails must be logged and discarded, never processed
- Reply token parsing must fail safely — unknown tokens produce a log entry, not an error response

### 8.3 Retell AI Webhooks

- Post-call data webhooks should verify the Retell source
- Call metadata must be validated before processing (tenant ID, contact ID must exist)

---

## 9. DEPLOYMENT SECURITY

### 9.1 Railway

- Production deploys via git push to main branch
- Always verify `npm run build` passes locally before pushing
- Always run `npm run db:push` after schema changes
- Always check that new files are committed (`git status`) — missing files cause build failures on Linux (case-sensitive filesystem)

### 9.2 Pre-Deploy Checklist

Before every production deploy:
1. `npm run build` passes locally
2. `npx tsc --noEmit` shows no new errors in touched files
3. `git status` shows no untracked files that should be committed
4. Schema changes documented and `db:push` planned
5. New env vars added to Railway before deploy
6. No secrets in code or logs

### 9.3 Post-Deploy Verification

After every production deploy:
1. App loads (not stuck on loading spinner or onboarding)
2. Xero sync works (if tokens exist)
3. No new console errors in Railway deploy logs
4. Key pages render: Dashboard, Debtors, Action Centre

---

## 10. INCIDENT RESPONSE

### 10.1 If Secrets Are Exposed

1. Immediately rotate the compromised key in the relevant service (Xero, SendGrid, Anthropic, etc.)
2. Update the Railway env var with the new key
3. Redeploy
4. Audit logs for unauthorised access during the exposure window
5. Document the incident

### 10.2 If Database Is Compromised

1. Xero tokens are encrypted at rest — attacker cannot use them without `PROVIDER_TOKEN_ENCRYPTION_KEY`
2. Rotate all Xero connections (disconnect + reconnect for each tenant)
3. Rotate `SESSION_SECRET` to invalidate all active sessions
4. Rotate `PROVIDER_TOKEN_ENCRYPTION_KEY`, re-encrypt all tokens
5. Notify affected tenants

### 10.3 If Unauthorised Emails Are Sent

1. Immediately set all tenants to `communicationMode = 'off'`
2. Investigate the root cause (compromised session, API abuse, compliance engine bypass)
3. Audit the `actions` and `emailMessages` tables for unauthorised sends
4. Notify affected debtors if necessary

---

## 11. SECURITY REVIEW CADENCE

| Review | Frequency | Owner |
|--------|-----------|-------|
| npm audit | Weekly | Automated / developer |
| Endpoint auth review | Monthly | CTO |
| Token encryption verification | Monthly | CTO |
| Client bundle secret scan | Every deploy | Automated |
| Rate limit effectiveness | Monthly | Developer |
| RBAC role assignments | Quarterly | Owner |
| Full security audit | Pre-acquisition | External |

---

## 12. CLAUDE CODE SESSION RULES

Every Claude Code session that modifies the codebase must:

1. **Never introduce plaintext secrets** — no API keys, tokens, or passwords in code
2. **Never create unauthenticated endpoints** — all new routes need `isAuthenticated` minimum
3. **Never bypass tenant isolation** — every query must be tenant-scoped
4. **Never expose server env vars to the client** — no Vite define or import.meta.env for secrets
5. **Never create direct database connections** — always use the Drizzle ORM layer
6. **Never log sensitive values** — log key names and event types, not token values or PII
7. **Never disable rate limiting** — even temporarily for testing
8. **Always encrypt new token fields** — any OAuth token stored at rest must use tryEncryptToken
9. **Always gate sensitive endpoints** — agent runs, syncs, data mutations need minimum `manager` role
10. **Always verify after deploy** — build passes, app loads, sync works, no new errors

If any of these rules would be violated by a requested change, flag it to the user before proceeding.

---

*Document version: 1.0 — 10 April 2026*
*Next review: Monthly by CTO*
*Location: ~/Documents/qashivo/SECURITY_POLICY.md*
