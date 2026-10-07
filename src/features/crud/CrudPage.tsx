/**
 * CrudPage (/crud) — admin-only tabular management of core entities.
 *
 * Rendered behind <AdminRoute> (checks the real profile.role). The server is
 * the authority: every read/write here is additionally gated by is_admin() RLS
 * policies, so a non-admin who somehow reaches the route still cannot read or
 * mutate anything.
 *
 * Tabs switch between profiles/roles, courses and rooms. Rows show their key
 * fields; a safe subset of columns is inline-editable, and rows can be deleted.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  CRUD_ENTITIES,
  crudConfig,
  useCrudDelete,
  useCrudList,
  useCrudUpdate,
  type CrudEntity,
  type CrudRow,
} from './api';

export function CrudPage() {
  const { isAdmin } = useAuth();
  const [entity, setEntity] = useState<CrudEntity>('profiles');

  // Defense in depth: the route guard + RLS already block non-admins; this is a
  // belt-and-suspenders message in case the component is reached directly.
  if (!isAdmin) {
    return <ErrorText>Acesso restrito a administradores.</ErrorText>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
          CRUD (admin)
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>
          Gerencie os dados principais da plataforma. Alterações são aplicadas
          imediatamente e protegidas por políticas de administrador no servidor.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {CRUD_ENTITIES.map((c) => (
          <Button
            key={c.entity}
            size="sm"
            variant={entity === c.entity ? 'primary' : 'secondary'}
            onClick={() => setEntity(c.entity)}
          >
            {c.label}
          </Button>
        ))}
      </nav>

      <EntityTable entity={entity} />
    </div>
  );
}

function EntityTable({ entity }: { entity: CrudEntity }) {
  const cfg = crudConfig(entity);
  const toast = useToast();
  const list = useCrudList(entity);
  const update = useCrudUpdate(entity);
  const del = useCrudDelete(entity);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  function startEdit(row: CrudRow) {
    const id = String(row[cfg.idKey]);
    setEditingId(id);
    const next: Record<string, string> = {};
    for (const key of cfg.editableKeys) {
      next[key] =
        row[key] === null || row[key] === undefined ? '' : String(row[key]);
    }
    setDraft(next);
  }

  async function saveEdit(id: string) {
    try {
      await update.mutateAsync({ id, patch: draft });
      toast.success('Registro atualizado.');
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm('Excluir este registro? Esta ação não pode ser desfeita.')
    ) {
      return;
    }
    try {
      await del.mutateAsync(id);
      toast.success('Registro excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  if (list.isLoading) return <Spinner size={28} />;
  if (list.isError)
    return <ErrorText>Não foi possível carregar os dados.</ErrorText>;

  const rows = list.data ?? [];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.85rem',
          minWidth: '40rem',
        }}
      >
        <thead>
          <tr>
            {cfg.columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '2px solid var(--color-border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
            <th
              style={{
                padding: '0.5rem',
                borderBottom: '2px solid var(--color-border)',
              }}
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row[cfg.idKey]);
            const editing = editingId === id;
            return (
              <tr
                key={id}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                {cfg.columns.map((col) => (
                  <td key={col.key} style={{ padding: '0.45rem 0.5rem' }}>
                    {editing && col.editable ? (
                      col.options ? (
                        <Select
                          value={draft[col.key] ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [col.key]: e.target.value,
                            }))
                          }
                          options={col.options.map((o) => ({
                            value: o,
                            label: o,
                          }))}
                        />
                      ) : (
                        <input
                          value={draft[col.key] ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [col.key]: e.target.value,
                            }))
                          }
                          style={{
                            padding: '0.3rem 0.4rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            font: 'inherit',
                            width: '100%',
                          }}
                        />
                      )
                    ) : (
                      formatCell(row[col.key])
                    )}
                  </td>
                ))}
                <td style={{ padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}>
                  {editing ? (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(id)}
                        loading={update.isPending}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startEdit(row)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => remove(id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={cfg.columns.length + 1}
                style={{ padding: '1rem', color: 'var(--color-text-muted)' }}
              >
                Nenhum registro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  return String(value);
}

export default CrudPage;
