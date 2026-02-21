import sanitizeHtmlLib from "sanitize-html";

export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return input;
  return sanitizeHtmlLib(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  });
}

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

export function stripSensitiveUserFields<T extends Record<string, any>>(user: T): Omit<T, 'password' | 'resetToken' | 'resetTokenExpiry' | 'stripeCustomerId' | 'stripeSubscriptionId'> {
  if (!user || typeof user !== 'object') return user;
  const { password, resetToken, resetTokenExpiry, stripeCustomerId, stripeSubscriptionId, ...safe } = user;
  return safe as any;
}

export function stripSensitiveTenantFields<T extends Record<string, any>>(tenant: T): Omit<T, 'xeroAccessToken' | 'xeroRefreshToken'> {
  if (!tenant || typeof tenant !== 'object') return tenant;
  const { xeroAccessToken, xeroRefreshToken, ...safe } = tenant;
  return safe as any;
}

export function stripSensitiveFields(data: any, type: 'user' | 'tenant'): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(item => stripSensitiveFields(item, type));
  if (type === 'user') return stripSensitiveUserFields(data);
  if (type === 'tenant') return stripSensitiveTenantFields(data);
  return data;
}
