/**
 * Data-access layer for account settings.
 *
 * - display_name / username persist to profiles (owner-only RLS; username is
 *   unique so a collision surfaces a friendly error).
 * - email change goes through supabase.auth.updateUser (sends a confirmation).
 * - password change reauthenticates with the current password, then updates.
 * - notification preferences persist to profiles.notification_preferences.
 * - account deletion is a SOFT deactivate/anonymize via the deactivate_account
 *   RPC (never a hard cascade delete).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/types/database';

export interface IdentityInput {
  displayName: string;
  username: string;
}

/** Persist display name + username on the profile. */
export function useUpdateIdentity(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IdentityInput): Promise<ProfileRow> => {
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: input.displayName.trim(),
          username: input.username.trim(),
        })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('Esse nome de usuário já está em uso.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/**
 * Request an email change. Supabase sends a confirmation link to the new address
 * (and, when "secure email change" is on, to the old one too); the change only
 * takes effect after confirmation.
 */
export function useChangeEmail() {
  return useMutation({
    mutationFn: async (newEmail: string): Promise<void> => {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail.trim() },
        { emailRedirectTo: `${window.location.origin}/settings` },
      );
      if (error) throw error;
    },
  });
}

/**
 * Change the password, requiring the current password. Reauthenticates by
 * signing in with the current password first (fails fast on a wrong password),
 * then calls updateUser with the new one.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      email: string;
      currentPassword: string;
      newPassword: string;
    }): Promise<void> => {
      // Reauthenticate: verify the current password.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.currentPassword,
      });
      if (reauthError) {
        throw new Error('Senha atual incorreta.');
      }
      const { error } = await supabase.auth.updateUser({
        password: input.newPassword,
      });
      if (error) throw error;
    },
  });
}

/** Persist the per-type notification preferences map on the profile. */
export function useUpdatePreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Record<string, boolean>): Promise<ProfileRow> => {
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('profiles')
        .update({ notification_preferences: prefs })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/**
 * Soft-delete the account: deactivate + anonymize via the deactivate_account
 * RPC (no hard cascade), then sign the user out locally.
 */
export function useDeactivateAccount() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('deactivate_account');
      if (error) throw error;
      await supabase.auth.signOut();
    },
  });
}
