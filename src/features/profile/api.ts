/**
 * Data-access layer for user profiles (own + third-party).
 *
 * A profile resolves by username. Reads the public profile fields plus derived
 * counts (enrolled courses, accepted friends) and the user's medals (featured
 * flag included). Profiles are readable by any authenticated user (RLS); only
 * the owner can update their row (role immutable).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MedalRow, ProfileRow, UserMedalRow } from '@/types/database';

export const profileKeys = {
  all: ['profile'] as const,
  byUsername: (username: string | undefined) =>
    ['profile', 'by-username', username] as const,
  medals: (userId: string | undefined) =>
    ['profile', 'medals', userId] as const,
};

export interface ProfileMedal {
  medal: MedalRow;
  award: UserMedalRow;
}

export interface ProfileView {
  profile: ProfileRow;
  enrolledCount: number;
  friendsCount: number;
  /** The user's earned medals (with featured flag). */
  medals: ProfileMedal[];
  /** True when the viewer owns this profile. */
  isOwner: boolean;
}

/**
 * Load a profile by username with its counts and medals. When `username` is
 * undefined, loads the current user's own profile (by `viewerId`).
 */
export function useProfile(
  username: string | undefined,
  viewerId: string | undefined,
) {
  return useQuery<ProfileView>({
    enabled: !!username || !!viewerId,
    queryKey: profileKeys.byUsername(username ?? `self:${viewerId}`),
    queryFn: async () => {
      // Resolve the profile row.
      let profile: ProfileRow | null = null;
      if (username) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();
        if (error) throw error;
        profile = data;
      } else if (viewerId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', viewerId)
          .maybeSingle();
        if (error) throw error;
        profile = data;
      }
      if (!profile) throw new Error('Perfil não encontrado.');

      const uid = profile.id;

      const [enrollRes, friendsRes, medalsRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid),
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        supabase
          .from('user_medals')
          .select('*, medal:medals(code, name, description, icon)')
          .eq('user_id', uid),
      ]);

      if (enrollRes.error) throw enrollRes.error;
      if (friendsRes.error) throw friendsRes.error;
      if (medalsRes.error) throw medalsRes.error;

      type MedalJoin = UserMedalRow & { medal: MedalRow | null };
      const medals: ProfileMedal[] = (
        (medalsRes.data ?? []) as unknown as MedalJoin[]
      )
        .filter((m) => m.medal)
        .map((m) => ({ award: m, medal: m.medal as MedalRow }));

      return {
        profile,
        enrolledCount: enrollRes.count ?? 0,
        friendsCount: friendsRes.count ?? 0,
        medals,
        isOwner: !!viewerId && viewerId === uid,
      };
    },
  });
}

export interface ProfileEditInput {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

/** Update the owner's editable profile fields (display name, bio, avatar, banner). */
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileEditInput): Promise<ProfileRow> => {
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: input.displayName.trim(),
          bio: input.bio.trim() || null,
          avatar_url: input.avatarUrl,
          banner_url: input.bannerUrl,
        })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Set which (up to 3) medals are featured on the profile. Unfeatures everything
 * then features the chosen set; a DB trigger also caps featured at 3.
 */
export function useSetFeaturedMedals(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codes: string[]): Promise<void> => {
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.');
      const chosen = codes.slice(0, 3);

      // Clear all first, then set the chosen ones. Two scoped updates keep this
      // simple under the owner-only RLS.
      const clear = await supabase
        .from('user_medals')
        .update({ featured: false })
        .eq('user_id', userId);
      if (clear.error) throw clear.error;

      if (chosen.length > 0) {
        const set = await supabase
          .from('user_medals')
          .update({ featured: true })
          .eq('user_id', userId)
          .in('medal_code', chosen);
        if (set.error) throw set.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Upload an avatar image to Supabase Storage (bucket "avatars") and return its
 * public URL. Falls back by throwing when Storage is not configured so the UI
 * can offer the URL-input alternative.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
