import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$32768$${salt.toString('base64')}$${(await derive(password, salt)).toString('base64')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, salt64, hash64] = encoded.split('$');
  const valid = algorithm === 'scrypt' && cost === '32768' && !!salt64 && !!hash64;
  const salt = valid ? Buffer.from(salt64, 'base64') : Buffer.alloc(16);
  const expected = valid ? Buffer.from(hash64, 'base64') : Buffer.alloc(64);
  const actual = await derive(password, salt);
  return valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
