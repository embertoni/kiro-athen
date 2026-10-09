/**
 * Data-access layer for the admin CRUD.
 *
 * All access is gated server-side by is_admin() RLS policies (profiles/courses/
 * rooms admin policies in 0011). The route is also wrapped by <AdminRoute>, but
 * the server is the authority: a non-admin's reads/writes here are rejected by
 * RLS regardless of the client guard.
 *
 * Entities are a small, generic set of core tables. Editing is intentionally
 * limited to a safe subset of columns per entity.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

/** Names of the tables the admin CRUD may operate on. */
type CrudTable = keyof Database['public']['Tables'];

/** The admin-manageable entities and their list columns. */
export type CrudEntity = 'profiles' | 'courses' | 'rooms';

export interface CrudColumn {
  key: string;
  label: string;
  /** When true, the column is editable in the inline editor. */
  editable?: boolean;
  /** Optional fixed choices (rendered as a select). */
  options?: readonly string[];
}

export interface CrudEntityConfig {
  entity: CrudEntity;
  label: string;
  table: CrudTable;
  idKey: string;
  orderBy: string;
  columns: CrudColumn[];
  /** Columns the admin may edit (subset of columns). */
  editableKeys: string[];
}

export const CRUD_ENTITIES: CrudEntityConfig[] = [
  {
    entity: 'profiles',
    label: 'Perfis / Papéis',
    table: 'profiles',
    idKey: 'id',
    orderBy: 'created_at',
    columns: [
      { key: 'username', label: 'Usuário' },
      { key: 'display_name', label: 'Nome', editable: true },
      {
        key: 'role',
        label: 'Papel',
        editable: true,
        options: ['student', 'educator', 'admin'] as const,
      },
      {
        key: 'account_status',
        label: 'Status',
        editable: true,
        options: ['active', 'deactivated'] as const,
      },
      { key: 'xp_global', label: 'XP' },
      { key: 'level', label: 'Nível' },
    ],
    editableKeys: ['display_name', 'role', 'account_status'],
  },
  {
    entity: 'courses',
    label: 'Cursos',
    table: 'courses',
    idKey: 'id',
    orderBy: 'created_at',
    columns: [
      { key: 'title', label: 'Título', editable: true },
      { key: 'slug', label: 'Slug' },
      { key: 'category', label: 'Categoria', editable: true },
      {
        key: 'status',
        label: 'Status',
        editable: true,
        options: ['draft', 'published'] as const,
      },
      {
        key: 'visibility',
        label: 'Visibilidade',
        editable: true,
        options: ['public', 'private'] as const,
      },
    ],
    editableKeys: ['title', 'category', 'status', 'visibility'],
  },
  {
    entity: 'rooms',
    label: 'Salas',
    table: 'rooms',
    idKey: 'id',
    orderBy: 'created_at',
    columns: [
      { key: 'name', label: 'Nome', editable: true },
      { key: 'access_code', label: 'Código' },
      {
        key: 'code_active',
        label: 'Código ativo',
        editable: true,
        options: ['true', 'false'] as const,
      },
      {
        key: 'pac_visibility',
        label: 'PAC',
        editable: true,
        options: ['members', 'educator_only', 'public'] as const,
      },
    ],
    editableKeys: ['name', 'code_active', 'pac_visibility'],
  },
];

export function crudConfig(entity: CrudEntity): CrudEntityConfig {
  const cfg = CRUD_ENTITIES.find((c) => c.entity === entity);
  if (!cfg) throw new Error(`Unknown entity ${entity}`);
  return cfg;
}

export type CrudRow = Record<string, unknown>;

/** Minimal result shape returned by the generic CRUD query builder. */
type CrudResult<T> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

/**
 * Narrow view of the Supabase client for the generic admin CRUD.
 *
 * The CRUD picks its table at runtime (`CrudEntityConfig.table`), so the typed
 * client cannot resolve a single per-table row/insert/update shape and would
 * reject `.select`/`.update`/`.delete` with "not assignable to type 'never'".
 * This interface describes exactly the generic operations the CRUD performs
 * with widened (`CrudRow`) payloads; `crudClient` casts the real client to it,
 * confining the cast to this one boundary. The server (is_admin RLS) remains
 * the authority over what these operations may actually read or write.
 */
interface CrudQueryClient {
  from(table: CrudTable): {
    select(columns: string): {
      order(
        column: string,
        opts: { ascending: boolean },
      ): { limit(count: number): CrudResult<CrudRow[]> };
    };
    update(values: CrudRow): {
      eq(column: string, value: string): CrudResult<null>;
    };
    delete(): { eq(column: string, value: string): CrudResult<null> };
  };
}

const crudClient = supabase as unknown as CrudQueryClient;

export const crudKeys = {
  list: (entity: CrudEntity) => ['crud', entity] as const,
};

/** List rows for an entity (admin-only via RLS). */
export function useCrudList(entity: CrudEntity) {
  const cfg = crudConfig(entity);
  return useQuery<CrudRow[]>({
    queryKey: crudKeys.list(entity),
    queryFn: async () => {
      const selectCols = Array.from(
        new Set([cfg.idKey, cfg.orderBy, ...cfg.columns.map((c) => c.key)]),
      ).join(', ');
      const { data, error } = await crudClient
        .from(cfg.table)
        .select(selectCols)
        .order(cfg.orderBy, { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Coerce an editor string value to the type the column expects. */
function coerceValue(raw: string): string | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

/** Update a single row's editable fields (admin-only via RLS). */
export function useCrudUpdate(entity: CrudEntity) {
  const cfg = crudConfig(entity);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Record<string, string>;
    }): Promise<void> => {
      const patch: Record<string, string | boolean> = {};
      for (const key of cfg.editableKeys) {
        if (key in input.patch) {
          patch[key] = coerceValue(input.patch[key]);
        }
      }
      const { error } = await crudClient
        .from(cfg.table)
        .update(patch)
        .eq(cfg.idKey, input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crudKeys.list(entity) });
    },
  });
}

/** Delete a row (admin-only via RLS). */
export function useCrudDelete(entity: CrudEntity) {
  const cfg = crudConfig(entity);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await crudClient
        .from(cfg.table)
        .delete()
        .eq(cfg.idKey, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crudKeys.list(entity) });
    },
  });
}
