import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** 256 bits of entropy — well above the 128-bit minimum. */
export const CARD_TOKEN_BYTES = 32;

const AES_IV_BYTES = 12;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{22,}$/;

export function generateCardToken(): string {
  return randomBytes(CARD_TOKEN_BYTES).toString('base64url');
}

export function hashCardToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_FORMAT.test(token);
}

export function tokenEntropyBits(token: string): number {
  // base64url alphabet = 64 symbols → 6 bits per character
  return Math.floor(token.length * 6);
}

export function resolveCardTokenSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.MEMBER_CARD_TOKEN_SECRET || env.JWT_SECRET;
  if (!secret) {
    throw new Error('MEMBER_CARD_TOKEN_SECRET or JWT_SECRET is required to protect card tokens');
  }
  return secret;
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
