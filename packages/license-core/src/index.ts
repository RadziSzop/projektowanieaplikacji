import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';
import { configSchema, type KeyFormat, type Verification } from '@app/contracts';

export const normalizeKey = (key: string) => key.trim().toUpperCase();
export const keyHash = (key: string) =>
  createHash('sha256').update(normalizeKey(key)).digest('hex');
const checksum = (body: string) =>
  createHash('sha256').update(body).digest('hex').slice(0, 8).toUpperCase();
export type StoredFormat = Omit<KeyFormat, 'separator'> & { separator: string };

export function generateKey(input: StoredFormat): string {
  const {
    prefix,
    alphabet,
    segmentCount,
    segmentLength,
    separator,
    checksum: enabled,
    validityDays,
  } = input;
  const format = configSchema.parse({
    prefix,
    alphabet,
    segmentCount,
    segmentLength,
    separator,
    checksum: enabled,
    validityDays,
  });
  const parts = [format.prefix];
  for (let i = 0; i < format.segmentCount; i++) {
    let segment = '';
    for (let j = 0; j < format.segmentLength; j++)
      segment += format.alphabet[randomInt(format.alphabet.length)];
    parts.push(segment);
  }
  const body = parts.join(format.separator);
  return format.checksum ? `${body}${format.separator}${checksum(body)}` : body;
}

export function matchesFormat(input: string, format: StoredFormat): boolean {
  const parts = normalizeKey(input).split(format.separator);
  if (
    parts.length !== 1 + format.segmentCount + Number(format.checksum) ||
    parts[0] !== format.prefix
  )
    return false;
  const random = parts.slice(1, 1 + format.segmentCount);
  if (
    random.some(
      (s) => s.length !== format.segmentLength || [...s].some((c) => !format.alphabet.includes(c)),
    )
  )
    return false;
  return !format.checksum || parts.at(-1) === checksum(parts.slice(0, -1).join(format.separator));
}

export function encryptionKey(secret: string): Buffer {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32 || key.toString('base64') !== secret)
    throw new Error('KEY_ENCRYPTION_KEY must be canonical base64 for 32 bytes');
  return key;
}
export function encryptKey(plaintext: string, secret: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptKey(bytes: Uint8Array, secret: string): string {
  const data = Buffer.from(bytes);
  if (data.length < 29) throw new Error('Invalid ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export function licenseState(
  license: { revokedAt: Date | null; expiresAt: Date | null },
  now = new Date(),
): Verification {
  if (license.revokedAt) return 'REVOKED';
  if (license.expiresAt && license.expiresAt <= now) return 'EXPIRED';
  return 'VALID';
}
