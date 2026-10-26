import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/** 256 bits of entropy — well above the 128-bit minimum. */
export const CARD_TOKEN_BYTES = 32;

const AES_IV_BYTES = 12;
const SHA256_HEX_BYTES = 32;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{22,}$/;

export function generateCardToken(): string {
  return randomBytes(CARD_TOKEN_BYTES).toString('base64url');
}

export function hashCardToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time compare of SHA-256 hex hashes (32 bytes). */
export function cardTokenHashesEqual(storedHex: string, presentedHex: string): boolean {
  try {
    const stored = Buffer.from(storedHex, 'hex');
    const presented = Buffer.from(presentedHex, 'hex');
    if (stored.length !== SHA256_HEX_BYTES || presented.length !== SHA256_HEX_BYTES) {
      return false;
    }
    return timingSafeEqual(stored, presented);
  } catch {
    return false;
  }
}

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_FORMAT.test(token);
}

export function tokenEntropyBits(token: string): number {
  // base64url alphabet = 64 symbols → 6 bits per character
  return Math.floor(token.length * 6);
}

function isProductionSecretRequired(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production' || !!env.RAILWAY_ENVIRONMENT;
}

/**
 * AES-GCM key for stored card tokens. Production/Railway MUST set
 * MEMBER_CARD_TOKEN_SECRET (do not reuse JWT_SECRET — rotating JWT would
 * make tokenEncrypted undecryptable and block export/re-write).
 */
export function resolveCardTokenSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dedicated = env.MEMBER_CARD_TOKEN_SECRET?.trim();
  if (dedicated) {
    return dedicated;
  }

  if (isProductionSecretRequired(env)) {
    throw new Error(
      'MEMBER_CARD_TOKEN_SECRET is required in production. Do not reuse JWT_SECRET — rotating JWT_SECRET would make stored card tokens undecryptable. Set MEMBER_CARD_TOKEN_SECRET on the Railway backend service to a long random string (32+ bytes).',
    );
  }

  const fallback = env.JWT_SECRET?.trim();
  if (fallback) {
    return fallback;
  }

  throw new Error(
    'MEMBER_CARD_TOKEN_SECRET is required to protect card tokens (JWT_SECRET is allowed only in development/test).',
  );
}

function aesKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM payload: iv.tag.ciphertext (base64url). Used only for admin export/write. */
export function encryptCardToken(token: string, secret: string): string {
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', aesKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptCardToken(payload: string, secret: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted card token');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    aesKey(secret),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function resolvePublicAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  // Printed/NFC URLs must hit production. Do not fall back to FRONTEND_URL (often localhost).
  const raw = env.PUBLIC_APP_URL || 'https://app.bldcebu.com';
  return raw.replace(/\/$/, '');
}

export function buildNfcUrl(token: string, appUrl = resolvePublicAppUrl()): string {
  return `${appUrl.replace(/\/$/, '')}/verify/${token}`;
}
