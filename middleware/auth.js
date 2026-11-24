import { verifySessionToken } from '../lib/auth.js';
import { getUserByUid } from '../lib/db.js';

export async function optionalAuth(req, _res, next) {
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
    const payload = verifySessionToken(token);
    if (payload) {
      const account = await getUserByUid(payload.uid);
      if (account) {
        req.user = payload;
        req.account = account;
      }
    }
  } catch {
    // Optional auth leaves request unauthenticated when token is invalid
  }
  next();
}

export async function requireAuth(req, res, next) {
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

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Сессия недействительна. Войдите снова.' });
    return;
  }

  try {
    const account = await getUserByUid(payload.uid);
    if (!account) {
      res.status(401).json({ error: 'Учётная запись не найдена. Войдите снова.' });
      return;
    }
    req.user = payload;
    req.account = account;
    next();
  } catch (error) {
    console.error('Error loading account during auth:', error);
    res.status(500).json({ error: 'Ошибка проверки учётной записи.' });
  }
}

export function requireAdmin(req, res, next) {
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
