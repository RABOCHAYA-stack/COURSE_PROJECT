import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';
import type { UserAccount, UserRole } from '../types.ts';

function toUserAccount(row: typeof users.$inferSelect): UserAccount {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName = '',
): Promise<UserAccount> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email,
          displayName: displayName || existing[0].displayName,
        })
        .where(eq(users.uid, uid))
        .returning();
      return toUserAccount(updated[0]);
    }

    const existingAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    const envAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const initialRole: UserRole =
      existingAdmins.length === 0 || (envAdmin && email.toLowerCase() === envAdmin)
        ? 'admin'
        : 'customer';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        role: initialRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
        },
      })
      .returning();

    return toUserAccount(inserted[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Не удалось загрузить профиль пользователя.', { cause: error });
  }
}

export async function listAllUsers(): Promise<UserAccount[]> {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(toUserAccount);
  } catch (error) {
    console.error('Database query failed in listAllUsers:', error);
    throw new Error('Не удалось получить список пользователей.', { cause: error });
  }
}

export async function updateUserRole(
  userId: number,
  role: UserRole,
  actingUid: string,
): Promise<UserAccount | null> {
  try {
    const targetRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (targetRows.length === 0) {
      return null;
    }

    if (targetRows[0].uid === actingUid && role !== 'admin') {
      throw new Error('SELF_DEMOTION');
    }

    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();

    return toUserAccount(updated[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'SELF_DEMOTION') {
      throw error;
    }
    console.error('Database query failed in updateUserRole:', error);
    throw new Error('Не удалось обновить роль пользователя.', { cause: error });
  }
}
