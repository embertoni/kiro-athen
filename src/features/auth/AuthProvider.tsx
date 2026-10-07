import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, UserRole } from '@/types/database';

/** Metadata consumed by the handle_new_user() trigger on signup. */
export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
  /** Only 'student' or 'educator' may self-register; 'admin' is reserved. */
  role: Extract<UserRole, 'student' | 'educator'>;
}

export interface SignInInput {
  /** Either an email address or a username. */
  identifier: string;
  password: string;
}

export interface AuthContextValue {
  session: Session | null;
  profile: ProfileRow | null;
  /** True until the initial session + profile load has settled. */
  loading: boolean;
  /** Convenience flag; the server (RLS/is_admin) remains authoritative. */
  isAdmin: boolean;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithEmailOrUsername: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  /** Re-fetch the current user's profile row. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    // A missing profile row (e.g. trigger lag just after signup) is not fatal.
    console.error('Failed to load profile', error);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    const next = await fetchProfile(userId);
    if (mounted.current) setProfile(next);
  }, [session?.user?.id]);

  // Bootstrap the session and subscribe to auth state changes.
  useEffect(() => {
    mounted.current = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted.current) return;
        setSession(data.session);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted.current) return;
        setSession(nextSession);
      },
    );

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keep the profile in sync with the active user.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    fetchProfile(userId).then((p) => {
      if (active && mounted.current) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        // Consumed by the handle_new_user() trigger to create the profile row.
        data: {
          username: input.username.trim(),
          display_name: input.displayName.trim(),
          role: input.role,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
    // When email confirmation is enabled, there is no active session yet.
    const needsEmailConfirmation = !data.session;
    return { needsEmailConfirmation };
  }, []);

  const signInWithEmailOrUsername = useCallback<
    AuthContextValue['signInWithEmailOrUsername']
  >(async ({ identifier, password }) => {
    const trimmed = identifier.trim();
    let email = trimmed;

    if (!looksLikeEmail(trimmed)) {
      // Resolve a username to its auth email via a SECURITY DEFINER RPC.
      const { data, error } = await supabase.rpc('username_to_email', {
        p_username: trimmed,
      });
      if (error) throw error;
      if (!data) {
        throw new Error('Usuário ou senha inválidos.');
      }
      email = data;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const requestPasswordReset = useCallback<
    AuthContextValue['requestPasswordReset']
  >(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(
    async (newPassword) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signUp,
      signInWithEmailOrUsername,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signUp,
      signInWithEmailOrUsername,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Must be used under an AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthProvider;
