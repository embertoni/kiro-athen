/**
 * Data-access layer for friendships.
 *
 * The friendships table is governed by RLS (either party reads; requester
 * creates; either responds/deletes). Sending a request additionally fires the
 * notify_friend_request RPC so the addressee gets a pedido_amizade notification,
 * and the study reminder goes through send_study_reminder (lembrete_estudo).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FriendshipRow, ProfileRow } from '@/types/database';
import { otherParticipantId } from './helpers';

export const friendKeys = {
  all: ['friends'] as const,
  list: (userId: string | undefined) => ['friends', 'list', userId] as const,
  search: (query: string) => ['friends', 'search', query] as const,
};

export type FriendProfile = Pick<
  ProfileRow,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'level'
>;

export interface FriendEdge {
  friendship: FriendshipRow;
  /** The other participant's profile (relative to the current user). */
  other: FriendProfile | null;
}

export interface FriendsBuckets {
  /** Accepted friendships. */
  friends: FriendEdge[];
  /** Pending requests the current user received (can accept/decline). */
  incoming: FriendEdge[];
  /** Pending requests the current user sent (can cancel). */
  outgoing: FriendEdge[];
}

const EDGE_SELECT =
  'id, requester_id, addressee_id, status, created_at, responded_at, ' +
  'requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, level), ' +
  'addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, level)';

type EdgeRow = FriendshipRow & {
  requester: FriendProfile | null;
  addressee: FriendProfile | null;
};

/**
 * Load the current user's friendships bucketed into accepted / incoming /
 * outgoing. Terminal (declined/cancelled) rows are omitted from the UI.
 */
export function useFriends(userId: string | undefined) {
  return useQuery<FriendsBuckets>({
    enabled: !!userId,
    queryKey: friendKeys.list(userId),
    queryFn: async () => {
      const uid = userId as string;
      const { data, error } = await supabase
        .from('friendships')
        .select(EDGE_SELECT)
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as EdgeRow[];
      const buckets: FriendsBuckets = { friends: [], incoming: [], outgoing: [] };

      for (const r of rows) {
        const otherId = otherParticipantId(uid, r);
        const other =
          otherId === r.requester_id ? r.requester : r.addressee;
        const edge: FriendEdge = { friendship: r, other };

        if (r.status === 'accepted') {
          buckets.friends.push(edge);
        } else if (r.status === 'pending') {
          if (r.addressee_id === uid) buckets.incoming.push(edge);
          else buckets.outgoing.push(edge);
        }
        // declined / cancelled: not surfaced.
      }
      return buckets;
    },
  });
}

/** Search users by username/display_name via the search_profiles RPC. */
export function useUserSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<FriendProfile[]>({
    enabled: trimmed.length >= 2,
    queryKey: friendKeys.search(trimmed),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_profiles', {
        p_query: trimmed,
      });
      if (error) throw error;
      const rows = (data ?? []) as {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        level: number;
      }[];
      return rows.map((r) => ({
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        level: r.level,
      }));
    },
  });
}

/**
 * Send a friend request. Reuses a terminal (declined/cancelled) row by resetting
 * it to pending (the unique-pair index prevents duplicates), otherwise inserts.
 * Then fires notify_friend_request so the addressee is notified.
 */
export function useSendRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addresseeId: string): Promise<FriendshipRow> => {
      const uid = userId;
      if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
      if (addresseeId === uid) throw new Error('Você não pode se adicionar.');

      // Is there an existing row for this unordered pair?
      const { data: existing, error: exErr } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${uid},addressee_id.eq.${addresseeId}),` +
            `and(requester_id.eq.${addresseeId},addressee_id.eq.${uid})`,
        )
        .maybeSingle();
      if (exErr) throw exErr;

      let row: FriendshipRow;
      if (existing) {
        if (existing.status === 'accepted') throw new Error('Vocês já são amigos.');
        if (existing.status === 'pending') throw new Error('Já existe um pedido pendente.');
        // Reset a terminal row; make the current user the requester.
        const { data, error } = await supabase
          .from('friendships')
          .update({
            requester_id: uid,
            addressee_id: addresseeId,
            status: 'pending',
            responded_at: null,
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await supabase
          .from('friendships')
          .insert({ requester_id: uid, addressee_id: addresseeId })
          .select('*')
          .single();
        if (error) throw error;
        row = data;
      }

      // Best-effort notification; do not fail the request if it errors.
      await supabase
        .rpc('notify_friend_request', { p_friendship_id: row.id })
        .then(({ error }) => {
          if (error) console.error('notify_friend_request failed', error);
        });

      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: friendKeys.list(userId) });
      qc.invalidateQueries({ queryKey: ['friends', 'search'] });
    },
  });
}

/** Accept a received friend request. */
export function useRespondRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      friendshipId: string;
      accept: boolean;
    }): Promise<void> => {
      const { error } = await supabase
        .from('friendships')
        .update({
          status: input.accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', input.friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: friendKeys.list(userId) });
    },
  });
}

/** Cancel a request the current user sent (sets cancelled). */
export function useCancelRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string): Promise<void> => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: friendKeys.list(userId) });
    },
  });
}

/** Remove an existing friend (deletes the row so the pair can start over). */
export function useRemoveFriend(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string): Promise<void> => {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: friendKeys.list(userId) });
    },
  });
}

/** Send a "lembrete para estudar" to an accepted friend (lembrete_estudo). */
export function useSendStudyReminder() {
  return useMutation({
    mutationFn: async (friendId: string): Promise<void> => {
      const { error } = await supabase.rpc('send_study_reminder', {
        p_friend_id: friendId,
      });
      if (error) throw error;
    },
  });
}
