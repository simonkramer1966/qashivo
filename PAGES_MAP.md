# Qashivo Application Pages Map

This document provides a comprehensive overview of all pages in the Qashivo application, their routes, access requirements, and navigation paths.

---

## Public Pages (No Authentication Required)

These pages are accessible without logging in:

### Investor & Partner Pages

| Page | Route | Description | Navigation |
|------|-------|-------------|------------|
| **Investor Demo** | `/investor-demo` | Main investor landing page with AI demos (voice, SMS) | Direct URL |
| **Investor Demo (Qashivo)** | `/investor-demo-qashivo` | Alternative investor demo page | Direct URL |
| **Investor Detail** | `/investor-detail` | Full investment deck overview (pitch deck content) | Redirect after investor demo form submission |
| **Beta Partner** | `/beta-partner` | Beta partner recruitment page | Direct URL (private link) |

### Debtor Portal

| Page | Route | Description | Navigation |
|------|-------|-------------|------------|
| **Debtor Portal** | `/debtor-portal` | Customer-facing portal for invoice viewing, disputes, payments | Magic link from email |

### Authentication Pages

| Page | Route | Description | Navigation |
|------|-------|-------------|------------|
| **Sign In** | `/signin` | Login page (Replit Auth) | Default landing for unauthenticated users |
| **Partner Registration** | `/partner/register` | Partner account creation | Direct URL |
| **Client Registration** | `/client/register` | Client account creation | Direct URL |

---

## Authenticated Pages (Login Required)

These pages require authentication and are accessible after logging in:

### Main Dashboard & Cashflow

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Cashboard** | `/` | Main dashboard with key metrics | ✅ "Cashboard" |
| **Cashflow** | `/cashflow` | Cashflow forecasting and analysis | ✅ "Cashflow" |
| **AI Forecast** | `/intelligent-forecast` | AI-powered cashflow predictions | ✅ "AI Forecast" |
| **Wallet** | `/wallet` | Financial wallet and transactions | ✅ "Wallet" |

### Core Operations

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Workspace** | `/action-centre` | Action items and task management | ✅ "Workspace" |
| **Customers** | `/contacts` | Customer/contact management | ✅ "Customers" |
| **Invoices** | `/invoices` | Invoice management and tracking | ✅ "Invoices" |

### Management & Reporting

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Workflows** | `/workflows` | Workflow automation management | ✅ "Workflows" |
| **Reports** | `/reports` | Reporting and analytics | ✅ "Reports" |

### AI & Intelligence

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **AI Insights** | `/insights` | AI-powered business insights | ✅ "AI Insights" |
| **Client Intelligence** | `/client-intelligence` | Customer behavior analytics | ✅ "Client Intelligence" |

### Settings & Account

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Settings** | `/settings` | Application settings | ❌ User menu only |
| **Account** | `/account` | User account management | ❌ User menu only |

### Partner Portal (Role: Partner)

These pages are only accessible to users with the "partner" role:

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **My Clients** | `/partner` | Partner dashboard for managing client tenants | ✅ In partner context |
| **Team & Users** | `/partner/team` | Team management (planned) | ✅ In partner context |
| **Settings** | `/partner/settings` | Partner settings (planned) | ✅ In partner context |

### Platform Admin (Internal Only)

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Platform Admin** | `/qashivo-admin` | Qashivo internal admin dashboard | ❌ Direct URL only |

### Investor Management (Internal Only)

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Investor CRM** | `/investor-crm` | Investor lead management | ❌ Direct URL only |
| **Docs Download** | `/docs-download` | Document download tracking | ❌ Direct URL only |

### Documentation (Internal Only)

| Page | Route | Description | Sidebar Navigation |
|------|-------|-------------|-------------------|
| **Documentation** | `/documentation` | Technical documentation viewer | ❌ Direct URL only |
| **Documentation Review** | `/documentation-review` | Documentation approval workflow | ❌ Direct URL only |

---

## Navigation Structure

### Left Sidebar Navigation

The sidebar dynamically changes based on the current page context:

#### Default Sidebar (Tenant Context)
- Cashboard
- Cashflow
- AI Forecast
- Wallet
- *(divider)*
- Workspace
- Customers
- Invoices
- *(divider)*
- Workflows
- Reports
- *(divider)*
- AI Insights
- Client Intelligence

#### Partner Sidebar (`/partner/*`)
- My Clients
- *(divider)*
- Team & Users
- Settings

#### Platform Admin Sidebar (`/qashivo-admin`)
- Platform Admin

### Top Navigation (Header)

Available in authenticated pages:
- **Organization Dropdown** (left) - Switch between accessible tenants (partners only)
- **User Avatar Menu** (right) - Access to:
  - View Profile
  - Settings
  - Account
  - Demo Mode Toggle
  - Log Out

---

## Access Control Summary

### By Authentication Status

| Status | Accessible Pages |
|--------|-----------------|
| **Unauthenticated** | `/investor-demo`, `/investor-demo-qashivo`, `/investor-detail`, `/beta-partner`, `/debtor-portal`, `/partner/register`, `/client/register`, `/signin` |
| **Authenticated** | All authenticated pages + investor/partner pages |

### By User Role

| Role | Special Access |
|------|---------------|
| **Owner** | Full access to tenant features |
| **Partner** | Access to `/partner` portal + multiple tenant switching |
| **Collector** | Standard tenant features |
| **Manager** | Standard tenant features |
| **Platform Admin** (flag) | Access to `/qashivo-admin` (internal only) |

### Multi-Tenant Access

- **Owners & Collectors**: Single tenant access only
- **Partners**: Can switch between multiple client tenants via organization dropdown
- **Platform Admins**: Can access all tenants for monitoring/support

---

## Special Features

### Inactivity Timer
- **Enabled**: All authenticated pages except investor/partner demo pages
- **Timeout**: 60 seconds of inactivity
- **Action**: Shows splash screen requiring re-entry

### Demo Mode
- Available via user avatar menu
- Toggles demo/test data visibility

---

## Page Access Patterns

### Direct URL Access
Pages accessible by typing URL directly:
- All public pages
- `/qashivo-admin` (platform admins only)
- `/investor-crm` (authenticated users)
- `/documentation` (authenticated users)
- `/documentation-review` (authenticated users)

### Sidebar Navigation
Pages accessible via left sidebar:
- Main dashboard pages
- Core operations
- Management & reporting
- AI & intelligence features
- Partner portal (when in `/partner` context)

### Header Navigation
Pages accessible via header/user menu:
- Settings
- Account
- Profile dialog

### Programmatic Navigation
Pages accessed through app flow:
- `/investor-detail` - Redirect after investor demo form submission
- `/debtor-portal` - Magic link from email notifications

---

## Route Protection

### Unauthenticated Route Behavior
When not logged in:
- All authenticated routes redirect to `/signin`
- Investor/partner/debtor pages remain accessible

### Authenticated Route Behavior
When logged in:
- All pages remain accessible
- Role-based restrictions apply
- Tenant isolation enforced

---

## Notes

- **Organization Switching**: Only available to partners; visible in header dropdown
- **Tenant Isolation**: All data is strictly isolated by tenant (except platform admin view)
- **Splash Screen**: Automatically triggered after 60s inactivity (can be disabled for demos)
- **Missing Sidebar Links**: Some pages (Settings, Account, Platform Admin) intentionally not in sidebar for cleaner UX
