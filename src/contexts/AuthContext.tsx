import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { UserAccount } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  account: UserAccount | null;
  idToken: string | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncAccountWithToken = useCallback(async (token: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? 'Не удалось подтвердить профиль.');
    }
    const data = (await res.json()) as { account: UserAccount };
    setAccount(data.account);
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIdToken(null);
        setAccount(null);
        setAuthReady(true);
        return;
      }

      try {
        const token = await user.getIdToken();
        setIdToken(token);
        await syncAccountWithToken(token);
      } catch (err) {
        console.error('Auth sync error:', err);
        setAccount(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [syncAccountWithToken]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
      await syncAccountWithToken(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа через Google';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Не удалось выполнить вход. Проверьте настройки всплывающих окон.');
      }
    } finally {
      setAuthBusy(false);
    }
  }, [syncAccountWithToken]);

  const signOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setIdToken(null);
      setAccount(null);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken(true);
    setIdToken(token);
    await syncAccountWithToken(token);
  }, [firebaseUser, syncAccountWithToken]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        account,
        idToken,
        authReady,
        authBusy,
        authError,
        signInWithGoogle,
        signOut,
        refreshAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
