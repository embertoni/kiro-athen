/**
 * Data-access layer for gamification rankings.
 *
 * - Global ranking: all-time, ordered by xp_global/level (NO weekly period/reset).
 *   Read from the global_ranking view (inherits profiles RLS: any authenticated).
 * - Room ranking: ordered by xp_internal among ACTIVE members (NO weekly/reset).
 *   Read via the rooms feature (useRoomMembers onlyActive=true); the pure sort
 *   comparator lives in rooms/helpers.ts.
 * - Friends ranking: per-course PAC/division for accepted friends (NOT global XP),
 *   via the friends_course_pac RPC (SECURITY DEFINER, friends-scoped).
 *
 * Server values are authoritative; the UI only mirrors constants for labels.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const rankingKeys = {
  global: (limit: number) => ['rankings', 'global', limit] as const,
  friendsCourse: (courseId: string | undefined) =>
    ['rankings', 'friends-course', courseId] as const,
};

export interface GlobalRankRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  xpGlobal: number;
  level: number;
  streakCount: number;
  position: number;
}

/** Global, all-time leaderboard ordered by XP. */
export function useGlobalRanking(limit = 50) {
  return useQuery<GlobalRankRow[]>({
    queryKey: rankingKeys.global(limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_ranking')
        .select('*')
        .order('position', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        xpGlobal: r.xp_global,
        level: r.level,
        streakCount: r.streak_count,
        position: r.position,
      }));
    },
  });
}

export interface FriendCoursePacRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isSelf: boolean;
  correct: number;
  total: number;
  pac: number;
  division: string;
}

/**
 * Friends ranking for a specific course, using PAC/division (not global XP).
 * Includes the caller (is_self) so the UI can highlight their own position.
 */
export function useFriendsCoursePac(courseId: string | null | undefined) {
  return useQuery<FriendCoursePacRow[]>({
    enabled: !!courseId,
    queryKey: rankingKeys.friendsCourse(courseId ?? undefined),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('friends_course_pac', {
        p_course_id: courseId as string,
      });
      if (error) throw error;
      const rows = (data ?? []) as {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        is_self: boolean;
        correct: number;
        total: number;
        pac: number;
        division: string;
      }[];
      return rows.map((r) => ({
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        isSelf: r.is_self,
        correct: r.correct,
        total: r.total,
        pac: r.pac,
        division: r.division,
      }));
    },
  });
}
