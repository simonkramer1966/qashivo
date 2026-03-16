import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'PROVIDER_TOKEN_ENCRYPTION_KEY env var not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (keyHex.length !== 64) {
    throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded string: IV (16 bytes) + authTag (16 bytes) + ciphertext
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // IV + authTag + ciphertext → single base64 string
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 * Expects format: IV (16 bytes) + authTag (16 bytes) + ciphertext
 */
export function decryptToken(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, 'base64');

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted token: too short');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Check if a string looks like it's already encrypted (base64-encoded, right minimum length).
 * Used to avoid double-encryption during migration.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  // Encrypted tokens are base64 and at least IV + authTag + 1 byte = 33 bytes → 44+ base64 chars
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Pattern.test(value)) return false;
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
