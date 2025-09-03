# replit.md

## Overview

AR Pro is an AI-driven accounts receivable and debt recovery application built with a modern full-stack architecture. The system helps businesses streamline their collection processes through intelligent automation, multi-channel communication, and data-driven insights. It provides comprehensive invoice management, automated workflows, and integration with external services like Xero, SendGrid, and Twilio to optimize cash flow and reduce days sales outstanding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: Shadcn/ui components built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with CSS variables for theming support
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with authentication middleware
- **Session Management**: Express sessions with PostgreSQL storage
- **Build System**: ESBuild for production bundling

### Database Architecture
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Multi-tenancy**: Tenant-based data isolation with foreign key relationships

### Authentication System
- **Provider**: Replit Auth using OpenID Connect
- **Strategy**: Passport.js with custom OIDC strategy
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **User Management**: Mandatory user and session tables for Replit Auth compliance

### Data Models
- **Core Entities**: Users, Tenants, Contacts, Invoices, Actions, Workflows
- **Relationships**: Multi-tenant architecture with proper foreign key constraints
- **Validation**: Zod schemas for runtime type checking and API validation

### Communication Channels
- **Email**: SendGrid integration for automated email campaigns
- **SMS**: Twilio integration for text message reminders
- **AI**: OpenAI integration for intelligent collection suggestions and email drafting

### Workflow Engine
- **Automation**: Custom workflow system for collection processes
- **Templates**: Pre-built workflow templates for different collection strategies
- **Actions**: Trackable communication actions with timestamps and responses

## External Dependencies

### Third-Party Services
- **Xero**: Accounting software integration for invoice synchronization
- **SendGrid**: Email delivery service for automated communications
- **Twilio**: SMS service for text message reminders
- **OpenAI**: AI service for generating collection suggestions and email drafts
- **Neon**: Serverless PostgreSQL hosting

### Development Tools
- **Replit**: Development environment with custom auth integration
- **Vite**: Frontend build tool with hot module replacement
- **Drizzle**: Database ORM and migration tool
- **TypeScript**: Type safety across frontend and backend

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Lucide**: Icon library
- **Tailwind CSS**: Utility-first CSS framework
- **Class Variance Authority**: Component variant management

### Monitoring and Development
- **Error Handling**: Custom error overlay for development
- **Logging**: Request/response logging with performance metrics
- **Session Management**: Secure cookie-based sessions with CSRF protection