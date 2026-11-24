import { useState } from 'react';
import { Shield, UserCheck } from 'lucide-react';
import type { UserAccount, UserRole } from '../types';
import { formatDateRu } from '../utils/format';

interface AccountsViewProps {
  users: UserAccount[];
  currentUid: string;
  onUpdateRole: (userId: number, role: UserRole) => Promise<void>;
}

export function AccountsView({
  users,
  currentUid,
  onUpdateRole,
}: AccountsViewProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: number, role: UserRole) {
    setError(null);
    setUpdatingId(userId);
    try {
      await onUpdateRole(userId, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить роль');
    } finally {
      setUpdatingId(null);
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const customerCount = users.filter((u) => u.role === 'customer').length;

  return (
    <div className="space-y-10">
      <div className="border-b border-zinc-200 pb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900">
          Учётные записи и роли доступа
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Администратор управляет каталогом, складом, поставщиками, историей покупок и ролями. Покупатель имеет доступ к каталогу и корзине.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-zinc-200 pb-8">
        <div>
          <div className="text-xs text-zinc-500">Всего аккаунтов</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {users.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Администраторов</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-emerald-900">
            {adminCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Покупателей</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-zinc-900">
            {customerCount}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium text-zinc-500">
                <th className="py-3 px-4">Пользователь</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Дата регистрации</th>
                <th className="py-3 px-4">Текущие права</th>
                <th className="py-3 px-4 text-right">Назначить роль</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {users.map((user) => {
                const isSelf = user.uid === currentUid;
                const isAdmin = user.role === 'admin';
                return (
                  <tr key={user.id} className="hover:bg-zinc-50/60">
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-900">
                        {user.displayName || 'Без имени'}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-emerald-800">
                            (Вы)
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-zinc-400 truncate max-w-[200px]">
                        {user.uid}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-700">{user.email}</td>
                    <td className="py-3 px-4 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                      {formatDateRu(user.createdAt)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          isAdmin ? 'text-emerald-900' : 'text-zinc-600'
                        }`}
                      >
                        {isAdmin ? (
                          <Shield className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isAdmin ? 'Администратор (полный доступ)' : 'Покупатель (каталог и корзина)'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <select
                        aria-label={`Роль для ${user.email}`}
                        value={user.role}
                        disabled={updatingId === user.id || isSelf}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as UserRole)
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-900 focus:outline-none"
                      >
                        <option value="admin">Администратор</option>
                        <option value="customer">Покупатель</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
