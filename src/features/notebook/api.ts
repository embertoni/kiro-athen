/**
 * Data-access layer for the personal notebook.
 *
 * notebooks + notebook_pages are owner-only (RLS). Content persists across
 * sessions. Pages are ordered by `position`; new pages append to the end.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NotebookPageRow, NotebookRow } from '@/types/db';

export const notebookKeys = {
  all: ['notebook'] as const,
  list: (userId: string | undefined) => ['notebook', 'list', userId] as const,
  pages: (notebookId: string | undefined) =>
    ['notebook', 'pages', notebookId] as const,
};

/** List the user's notebooks (newest first). */
export function useNotebooks(userId: string | undefined) {
  return useQuery<NotebookRow[]>({
    enabled: !!userId,
    queryKey: notebookKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** List a notebook's pages ordered by position. */
export function useNotebookPages(notebookId: string | undefined) {
  return useQuery<NotebookPageRow[]>({
    enabled: !!notebookId,
    queryKey: notebookKeys.pages(notebookId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notebook_pages')
        .select('*')
        .eq('notebook_id', notebookId as string)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateNotebook(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string): Promise<NotebookRow> => {
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('notebooks')
        .insert({ user_id: userId, title: title.trim() || 'Novo caderno' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(userId) });
    },
  });
}

export function useRenameNotebook(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string }): Promise<void> => {
      const { error } = await supabase
        .from('notebooks')
        .update({ title: input.title.trim() || 'Caderno' })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(userId) });
    },
  });
}

export function useDeleteNotebook(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('notebooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.list(userId) });
    },
  });
}

export function useCreatePage(notebookId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      position: number;
    }): Promise<NotebookPageRow> => {
      if (!notebookId) throw new Error('Selecione um caderno.');
      const { data, error } = await supabase
        .from('notebook_pages')
        .insert({
          notebook_id: notebookId,
          title: input.title.trim() || 'Nova página',
          position: input.position,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.pages(notebookId) });
    },
  });
}

/** Save a page's title and content (the autosave/save-button target). */
export function useSavePage(notebookId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      content: string;
    }): Promise<NotebookPageRow> => {
      const { data, error } = await supabase
        .from('notebook_pages')
        .update({
          title: input.title.trim() || 'Página',
          content: input.content,
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.pages(notebookId) });
    },
  });
}

export function useDeletePage(notebookId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notebook_pages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.pages(notebookId) });
    },
  });
}

/** Move a page up/down by swapping positions with its neighbour. */
export function useReorderPage(notebookId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      page: NotebookPageRow;
      neighbour: NotebookPageRow;
    }): Promise<void> => {
      const { page, neighbour } = input;
      const a = await supabase
        .from('notebook_pages')
        .update({ position: neighbour.position })
        .eq('id', page.id);
      if (a.error) throw a.error;
      const b = await supabase
        .from('notebook_pages')
        .update({ position: page.position })
        .eq('id', neighbour.id);
      if (b.error) throw b.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notebookKeys.pages(notebookId) });
    },
  });
}
