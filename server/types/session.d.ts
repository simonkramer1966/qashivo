import "express-session";

declare module "express-session" {
  interface SessionData {
    debtorAuth?: {
      contactId: string;
      tenantId: string;
      tokenId: string;
      authenticatedAt: string;
    };
    oauthUserId?: string;
  }
}
