import crypto from 'node:crypto';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex || expectedHex.length !== 128) {
    return false;
  }
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (derivedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function issueSessionToken(account) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    uid: account.uid,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest();

  let actualSig;
  try {
    actualSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.uid !== 'string' || !Number.isFinite(parsed.exp)) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.exp <= nowSec) return null;
    return { uid: parsed.uid };
  } catch {
    return null;
  }
}
