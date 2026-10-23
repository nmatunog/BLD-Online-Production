import {
  buildNfcUrl,
  CARD_TOKEN_BYTES,
  decryptCardToken,
  encryptCardToken,
  generateCardToken,
  hashCardToken,
  isValidTokenFormat,
  resolveCardTokenSecret,
  resolvePublicAppUrl,
  tokenEntropyBits,
} from './member-card-token.util';

describe('member-card-token.util', () => {
  const secret = 'test-card-secret';

  it('generates a URL-safe token with at least 128 bits of entropy', () => {
    const token = generateCardToken();
    expect(isValidTokenFormat(token)).toBe(true);
    expect(token).not.toMatch(/[+/=]/);
    expect(tokenEntropyBits(token)).toBeGreaterThanOrEqual(128);
    expect(CARD_TOKEN_BYTES * 8).toBeGreaterThanOrEqual(128);
  });

  it('hashes tokens so the plaintext cannot be recovered from the hash', () => {
    const token = generateCardToken();
    const hash = hashCardToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashCardToken(token));
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });

  it('encrypts and decrypts a token for printer/write export', () => {
    const token = generateCardToken();
    const encrypted = encryptCardToken(token, secret);
    expect(encrypted).not.toBe(token);
    expect(encrypted.split('.')).toHaveLength(3);
    expect(decryptCardToken(encrypted, secret)).toBe(token);
    expect(() => decryptCardToken(encrypted, 'other-secret')).toThrow();
  });

  it('builds the production verify URL', () => {
    expect(buildNfcUrl('abcTOKEN', 'https://app.bldcebu.com/')).toBe(
      'https://app.bldcebu.com/verify/abcTOKEN',
    );
    expect(resolvePublicAppUrl({})).toBe('https://app.bldcebu.com');
    expect(resolvePublicAppUrl({ FRONTEND_URL: 'http://localhost:3000' })).toBe(
      'https://app.bldcebu.com',
    );
    expect(resolvePublicAppUrl({ PUBLIC_APP_URL: 'https://staging.example' })).toBe(
      'https://staging.example',
    );
  });

  it('requires a secret from env', () => {
    expect(() => resolveCardTokenSecret({})).toThrow(/JWT_SECRET|MEMBER_CARD_TOKEN_SECRET/);
    expect(resolveCardTokenSecret({ JWT_SECRET: 'jwt' })).toBe('jwt');
    expect(resolveCardTokenSecret({ MEMBER_CARD_TOKEN_SECRET: 'card', JWT_SECRET: 'jwt' })).toBe(
      'card',
    );
  });

  it('rejects short or unsafe token formats', () => {
    expect(isValidTokenFormat('short')).toBe(false);
    expect(isValidTokenFormat('has/slash+plus=')).toBe(false);
    expect(isValidTokenFormat('a'.repeat(22))).toBe(true);
  });
});
