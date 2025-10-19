# Qashivo/Nexus AR Documentation Index

**Last Updated:** October 19, 2025

Welcome to the Qashivo documentation. This index organizes all technical documentation to help you quickly find what you need.

---

## 📚 Documentation Overview

This project maintains 6 comprehensive markdown documentation files covering architecture, security, features, and developer guidance. Use this index to navigate to the right document for your needs.

---

## 🚀 Getting Started

**New to the project? Start here:**

### [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md)
**Purpose:** Complete developer onboarding guide with setup instructions and technical specifications  
**When to use:** First time working on the project, need environment setup, or reference for coding patterns  
**Update when:** Adding new coding patterns, updating tech stack, changing project structure, or documenting common issues  
**Key sections:**
- Quick start guide and environment setup
- Tech stack overview (React, Express, PostgreSQL, Drizzle ORM)
- Project structure and file organization
- Coding conventions and best practices
- Common troubleshooting and gotchas
- Development workflows and testing patterns

**Size:** 1,237 lines

---

## 🏗️ System Architecture

### [replit.md](./replit.md)
**Purpose:** High-level project overview, architecture decisions, and user preferences  
**When to use:** Understanding project goals, system architecture, or external dependencies  
**Update when:** Changing system architecture, adding external dependencies, modifying UI/UX design system, or updating business model  
**Key sections:**
- Project overview and business goals
- User preferences (Tufte/Few data visualization principles, glassmorphism UI)
- System architecture (frontend, backend, database, authentication)
- Partner architecture (B2B2B model)
- Platform admin system
- Feature specifications (Intent Analyst, AI Voice, Workflow Engine, Debtor Portal)
- External dependencies (Xero, SendGrid, Vonage, OpenAI, Retell, Stripe)

**Size:** Comprehensive project reference

---

### [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md)
**Purpose:** B2B2B partner model architecture and multi-tenant data isolation  
**When to use:** Working with partners, tenants, or multi-tenant features  
**Update when:** Modifying partner model, changing tenant provisioning, updating partner permissions, or adding partner portal features  
**Key sections:**
- Three-tier hierarchy (Partner → Tenant → User)
- Partner entity and capabilities
- Role-based access control for partners
- Session management and tenant switching
- Data isolation patterns and middleware
- Onboarding flows and provisioning
- Partner portal features and API patterns

**Size:** 1,336 lines

---

## 🔐 Security & Compliance

### [SECURITY.md](./SECURITY.md)
**Purpose:** Complete security architecture, authentication, authorization, and RBAC system  
**When to use:** Implementing auth features, working with permissions, or security reviews  
**Update when:** Adding new permissions, modifying auth flows, implementing new security features, or addressing security vulnerabilities  
**Key sections:**
- Authentication architecture (Replit OAuth, magic links, OTP)
- Role-based access control (50+ granular permissions)
- Multi-tenant security and data isolation
- Session management and security middleware
- Input validation and sanitization
- Webhook security (HMAC verification)
- Platform admin security model
- Debtor portal authentication (magic link + OTP)
- Security best practices and threat mitigation

**Size:** 1,065 lines

---

## ⚙️ Feature Documentation

### [DISPUTE_SYSTEM.md](./DISPUTE_SYSTEM.md)
**Purpose:** Comprehensive specification for the debtor dispute management system  
**When to use:** Working on dispute features, debtor portal, or collector workflows  
**Update when:** Modifying dispute workflows, adding dispute types, changing evidence handling, or updating debtor/collector interfaces  
**Key sections:**
- Dispute data model and lifecycle
- Debtor-facing dispute submission flow
- Collector-facing dispute management interface
- Supporting evidence handling (file uploads)
- Email notifications and communication
- Database schema and API endpoints
- UI/UX specifications with glassmorphism styling

**Size:** Comprehensive feature specification

---

## 📖 Reference

### [PAGES_MAP.md](./PAGES_MAP.md)
**Purpose:** Complete map of all application pages, routes, and access patterns  
**When to use:** Finding page routes, understanding navigation, or checking access control  
**Update when:** Adding/removing pages, changing routes, modifying access patterns, or updating navigation structure  
**Key sections:**
- Public pages (marketing, investor detail, beta partner)
- Authenticated internal pages (dashboard, invoices, contacts, workflows)
- Partner portal pages (partner dashboard, onboarding)
- Platform admin pages (user/tenant/partner management)
- Debtor self-service portal pages (payment, dispute, PTP)
- Investor demo pages (AI voice demo, SMS intent demo)
- Authentication flows and route protection patterns

**Size:** Complete page inventory

---

## 📋 Quick Reference by Use Case

### "I need to add a new page"
→ See [PAGES_MAP.md](./PAGES_MAP.md) for routing patterns  
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for UI component patterns  
→ See [replit.md](./replit.md) for glassmorphism styling guidelines

### "I need to add authentication/permissions"
→ See [SECURITY.md](./SECURITY.md) for complete auth architecture  
→ See [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) for multi-tenant patterns  
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for middleware implementation

### "I need to work with partners/tenants"
→ See [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) for B2B2B model  
→ See [SECURITY.md](./SECURITY.md) for tenant isolation  
→ See [PAGES_MAP.md](./PAGES_MAP.md) for partner portal routes

### "I need to modify the dispute system"
→ See [DISPUTE_SYSTEM.md](./DISPUTE_SYSTEM.md) for complete specification  
→ See [SECURITY.md](./SECURITY.md) for debtor authentication  
→ See [PAGES_MAP.md](./PAGES_MAP.md) for debtor portal routes

### "I'm conducting a security review"
→ See [SECURITY.md](./SECURITY.md) for security architecture and threat mitigation  
→ See [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) for data isolation patterns  
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for validation patterns

### "I need to update investor materials"
→ See [PAGES_MAP.md](./PAGES_MAP.md) for investor page routes  
→ See [replit.md](./replit.md) for business model and pitch deck content  
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for demo page patterns

### "I'm onboarding a new partner/tenant"
→ See [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) for onboarding flows  
→ See [SECURITY.md](./SECURITY.md) for provisioning and access control  
→ See [PAGES_MAP.md](./PAGES_MAP.md) for partner portal navigation

### "I'm setting up my development environment"
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for setup guide  
→ See [replit.md](./replit.md) for external dependencies  
→ See [SECURITY.md](./SECURITY.md) for DEBUG_AUTH environment variable

### "I need to integrate a new external service"
→ See [replit.md](./replit.md) for existing integrations reference  
→ See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for API integration patterns  
→ See [SECURITY.md](./SECURITY.md) for webhook security and secret management

---

## 🎯 Documentation by Audience

### For New Developers
1. [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) - Start here for onboarding
2. [replit.md](./replit.md) - Understand the project vision
3. [PAGES_MAP.md](./PAGES_MAP.md) - Learn the application structure

### For Backend Engineers
1. [SECURITY.md](./SECURITY.md) - Auth, RBAC, and security patterns
2. [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) - Multi-tenant architecture
3. [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) - API patterns and storage interface

### For Frontend Engineers
1. [PAGES_MAP.md](./PAGES_MAP.md) - All routes and navigation
2. [replit.md](./replit.md) - UI/UX guidelines (glassmorphism, Tufte principles)
3. [DISPUTE_SYSTEM.md](./DISPUTE_SYSTEM.md) - Feature UI specifications

### For Product/Business Stakeholders
1. [replit.md](./replit.md) - Project overview and business model
2. [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md) - B2B2B partnership model
3. [PAGES_MAP.md](./PAGES_MAP.md) - Feature inventory and user flows

---

## 🔄 Keeping Documentation Updated

When making changes to the project, update the relevant documentation:

- **Adding/removing pages** → Update [PAGES_MAP.md](./PAGES_MAP.md)
- **Changing auth/permissions** → Update [SECURITY.md](./SECURITY.md)
- **Modifying partner features** → Update [PARTNER_HIERARCHY.md](./PARTNER_HIERARCHY.md)
- **Adding new features** → Create feature spec (like [DISPUTE_SYSTEM.md](./DISPUTE_SYSTEM.md))
- **Changing architecture** → Update [replit.md](./replit.md)
- **Developer patterns** → Update [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md)

---

## 📞 Additional Resources

- **GitHub Repository:** Internal Qashivo repository
- **Live Environment:** Available via Replit workspace
- **Design System:** Glassmorphism with burgundy (#8B2635), gold (#A98743), navy (#0E131F), turquoise (#17B6C3)
- **API Documentation:** See individual endpoint specs in [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md)

---

**Need help?** Start with [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for common issues and troubleshooting.
