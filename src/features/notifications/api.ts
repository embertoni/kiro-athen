/**
 * Data-access layer for internal notifications.
 *
 * Notifications are inserted SERVER-SIDE through SECURITY DEFINER functions (see
 * 0016); clients can only read their own rows (recipient-only RLS) and flip
 * is_read. This module reads the list + unread count and marks rows read.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/types/db';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string | undefined) =>
    ['notifications', 'list', userId] as const,
  unread: (userId: string | undefined) =>
    ['notifications', 'unread', userId] as const,
};

/** The current user's notifications, newest first. */
export function useNotifications(userId: string | undefined) {
  return useQuery<NotificationRow[]>({
    enabled: !!userId,
    queryKey: notificationKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Lightweight unread count for the header bell (polled on an interval). */
export function useUnreadCount(userId: string | undefined) {
  return useQuery<number>({
    enabled: !!userId,
    queryKey: notificationKeys.unread(userId),
    // Keep the bell reasonably fresh without a realtime subscription.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId as string)
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Mark a single notification as read. */
export function useMarkRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) });
    },
  });
}

/** Mark every unread notification as read. */
export function useMarkAllRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId as string)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) });
    },
  });
}
