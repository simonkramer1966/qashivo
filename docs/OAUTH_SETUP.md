# OAuth Integration Setup

This guide covers how to configure OAuth credentials for each integration provider.

## Google Workspace (Gmail)

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API** under APIs & Services > Library

### 2. Configure OAuth Consent Screen

1. Go to APIs & Services > OAuth consent screen
2. Select **External** user type
3. Fill in app name ("Qashivo"), support email, and developer contact
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
5. Add test users if in "Testing" publishing status

### 3. Create OAuth Credentials

1. Go to APIs & Services > Credentials
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Add authorized redirect URI:
   ```
   {SITE_BASE_URL}/api/email-connection/google/callback
   ```
   For production: `https://qashivo-production.up.railway.app/api/email-connection/google/callback`
5. Copy the **Client ID** and **Client Secret**

### 4. Set Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## Microsoft 365 (Outlook)

### 1. Register an Application in Azure AD

1. Go to [Azure Portal](https://portal.azure.com/) > Azure Active Directory > App registrations
2. Click **New registration**
3. Name: "Qashivo"
4. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
5. Redirect URI (Web):
   ```
   {SITE_BASE_URL}/api/email-connection/microsoft/callback
   ```
   For production: `https://qashivo-production.up.railway.app/api/email-connection/microsoft/callback`

### 2. Configure API Permissions

1. Go to API permissions > Add a permission > Microsoft Graph > Delegated permissions
2. Add:
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `openid`
   - `profile`
   - `email`
   - `offline_access`
3. Grant admin consent if required

### 3. Create Client Secret

1. Go to Certificates & secrets > New client secret
2. Set an expiry period
3. Copy the **Value** (not the Secret ID)

### 4. Set Environment Variables

```env
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
```

---

## Xero (Accounting)

### 1. Create a Xero App

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage/)
2. Click **New app**
3. App name: "Qashivo"
4. Integration type: **Web app**
5. Company or application URL: `https://qashivo.com`
6. Redirect URI:
   ```
   {SITE_BASE_URL}/api/xero/callback
   ```
   For production: `https://qashivo-production.up.railway.app/api/xero/callback`

### 2. Set Environment Variables

```env
XERO_CLIENT_ID=your-xero-client-id
XERO_CLIENT_SECRET=your-xero-client-secret
```

### Scopes Used

Qashivo requests the following Xero scopes:
- `openid` — authentication
- `profile` — user identity
- `email` — user email
- `accounting.transactions.read` — invoices, bills, payments
- `accounting.contacts.read` — contacts/debtors
- `accounting.settings.read` — organisation settings

---

## Notes

- **SITE_BASE_URL** must be set in your environment for OAuth callbacks to work correctly. This should be the canonical URL of your deployment (e.g., `https://qashivo-production.up.railway.app`).
- All OAuth tokens are stored in the database. Accounting provider tokens are in the `providerConnections` table; email tokens are on the `tenants` table.
- Token refresh happens automatically before expiry for all providers.
