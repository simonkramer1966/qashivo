# Qashivo — Architecture Decision Records

## 2026-03-26 — CC handling in email send pipeline

**Context:** Added CC functionality to the email send pipeline for both manual (drawer) and automated (collections agent) emails.

**Decision:**
- CC recipients are **suppressed** in `testing` and `soft_live` modes — only the To: address is redirected to the test address
- When CC is suppressed, a note is injected into the email body showing who would have been CC'd, so testers can verify
- In `live` mode, CC recipients receive the email as normal
- Escalation contacts (`isEscalation` on `customerContactPersons`) are auto-populated as CC in the drawer and auto-CC'd on agent-sent emails
- CC addresses stored in `emailMessages.ccRecipients` (jsonb) — empty when suppressed, real addresses in live mode

**Files modified:**
- `shared/schema.ts` — added `ccRecipients` jsonb column to `emailMessages`
- `server/services/sendgrid.ts` — `sendEmail()` accepts `cc?: string[]`, suppresses in non-live modes with banner note
- `server/services/email/ConnectedEmailService.ts` — CC support for Gmail (RFC 2822 Cc header) and Outlook (ccRecipients array)
- `server/services/collectionsPipeline.ts` — auto-CC escalation contacts on agent-sent emails
- `server/routes/contactRoutes.ts` — send-email route accepts `cc[]` in request body
- `server/services/customerTimelineService.ts` — exposed `isEscalation` in preview data
- `client/src/components/customers/CustomerPreviewDrawer.tsx` — CC field UI with chips and auto-populate

## 2026-03-22 — Central communication mode enforcement wrapper

**Context:** Security audit of all outbound communication paths found 5 unprotected send paths, including a critical connected email bypass where emails dispatched via a tenant's connected email account skipped the communication mode check entirely. In testing mode, this could send real emails to real debtors.

**Vulnerabilities found:**
1. **Critical** — Connected email service bypass: emails sent via connected account before mode check
2. **High** — `sendBulkEmails()` and `sendEmailWithAttachment()` had no tenantId parameter and no mode check
3. **High** — SMS helper functions (`sendPaymentReminderSMS`, `sendUrgentPaymentNotice`, `sendCustomSMS`) didn't forward tenantId
4. **Medium** — `soft_live` mode fell through to `live` behaviour (no opt-in mechanism exists)
5. **Medium** — 5 call sites across routes.ts, invoiceRoutes.ts, and SendGridProvider.ts missing tenantId

**Decision:** All outbound email, SMS, and voice must route through the central enforcement wrapper:
- Email: `enforceCommunicationMode()` in `server/services/sendgrid.ts`
- SMS: inline mode check in `server/services/vonage.ts`
- Voice: `sendVoiceCall()` in `server/services/communications/sendVoiceCall.ts`

**Fail-closed:** DB errors block sends rather than allow them through. In production, if the communication mode cannot be verified, the send is rejected.

**Soft Live:** Currently behaves identically to Testing mode (redirects to test addresses) because no contact-level opt-in flag exists yet. When opt-in is built, Soft Live will send to opted-in contacts and redirect others.

**Voice (Retell):** ~~Not yet covered.~~ **Closed 22 March 2026.** Created `sendVoiceCall()` wrapper in `server/services/communications/sendVoiceCall.ts`. All 5 tenant-scoped Retell call sites refactored to use it. Investor demo endpoint and MCP admin tools are exempt (no tenant context, documented with safety comments).

**Files modified (email/SMS audit):**
- `server/services/sendgrid.ts` — rewrote with centralised `enforceCommunicationMode()`, moved check before connected email routing
- `server/services/vonage.ts` — added tenantId to interface, mode checks, updated helper functions
- `server/routes.ts` — added tenantId to 2 SMS call sites
- `server/routes/invoiceRoutes.ts` — added tenantId to 1 attachment email call
- `server/middleware/providers/SendGridProvider.ts` — added tenantId passthrough to 2 calls

**Files modified (voice wrapper — 22 March 2026):**
- `server/services/communications/sendVoiceCall.ts` — **NEW** central voice call wrapper with mode enforcement
- `server/routes/invoiceRoutes.ts` — refactored AI voice call to use `sendVoiceCall()`
- `server/services/actionExecutor.ts` — refactored to use `sendVoiceCall()`
- `server/services/communicationsOrchestrator.ts` — refactored to use `sendVoiceCall()`
- `server/routes.ts` — refactored test voice call to use `sendVoiceCall()`; added safety comments to investor demo + MCP proxy
- `server/routes/contactRoutes.ts` — refactored schedule-call to use `sendVoiceCall()`
- `server/mcp/tools/call.ts` — added safety comment (admin tool, no tenant context)
