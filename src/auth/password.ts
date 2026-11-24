import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + (await derive(password, salt)).toString('hex');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, key, extra] = stored.split('$');
  if (kind !== 'scrypt' || extra !== undefined || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(key ?? '')) return false;
  return timingSafeEqual(await derive(password, Buffer.from(salt, 'hex')), Buffer.from(key, 'hex'));
}
