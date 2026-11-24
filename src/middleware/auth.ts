import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import type { UserAccount } from '../types.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  account?: UserAccount;
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.account = await getOrCreateUser(
      decoded.uid,
      decoded.email ?? '',
      typeof decoded.name === 'string' ? decoded.name : '',
    );
  } catch (err) {
    console.warn('Optional auth token verification failed:', err);
  }
  next();
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется вход в аккаунт.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Отсутствует токен авторизации.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.account = await getOrCreateUser(
      decoded.uid,
      decoded.email ?? '',
      typeof decoded.name === 'string' ? decoded.name : '',
    );
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Сессия недействительна. Войдите снова.' });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.account) {
    res.status(401).json({ error: 'Требуется вход в аккаунт.' });
    return;
  }
  if (req.account.role !== 'admin') {
    res.status(403).json({
      error: 'Доступ разрешён только администратору магазина.',
    });
    return;
  }
  next();
}
