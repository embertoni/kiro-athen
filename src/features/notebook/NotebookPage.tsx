/**
 * NotebookPage (/notebook) — a persisted personal notebook with pages CRUD.
 *
 * Left column: the user's notebooks + the pages of the selected notebook (with
 * create, reorder, delete). Right column: the selected page's title + content
 * editor with a Save action. All content is persisted to notebooks /
 * notebook_pages (owner-only) and survives across sessions.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import type { NotebookPageRow } from '@/types/db';
import {
  useCreateNotebook,
  useCreatePage,
  useDeleteNotebook,
  useDeletePage,
  useNotebookPages,
  useNotebooks,
  useReorderPage,
  useSavePage,
} from './api';

export function NotebookPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const toast = useToast();

  const notebooksQuery = useNotebooks(userId);
  const createNotebook = useCreateNotebook(userId);
  const deleteNotebook = useDeleteNotebook(userId);

  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const notebooks = notebooksQuery.data ?? [];

  // Default to the first notebook once loaded.
  useEffect(() => {
    if (!notebookId && notebooks.length > 0) {
      setNotebookId(notebooks[0].id);
    }
  }, [notebooks, notebookId]);

  const pagesQuery = useNotebookPages(notebookId ?? undefined);
  const pages = pagesQuery.data ?? [];
  const createPage = useCreatePage(notebookId ?? undefined);
  const deletePage = useDeletePage(notebookId ?? undefined);
  const reorderPage = useReorderPage(notebookId ?? undefined);

  // Default to the first page of the selected notebook.
  useEffect(() => {
    if (pages.length === 0) {
      setPageId(null);
    } else if (!pages.some((p) => p.id === pageId)) {
      setPageId(pages[0].id);
    }
  }, [pages, pageId]);

  const activePage = pages.find((p) => p.id === pageId) ?? null;

  async function handleCreateNotebook() {
    try {
      const nb = await createNotebook.mutateAsync('Novo caderno');
      setNotebookId(nb.id);
      toast.success('Caderno criado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function handleDeleteNotebook(id: string) {
    try {
      await deleteNotebook.mutateAsync(id);
      if (notebookId === id) setNotebookId(null);
      toast.success('Caderno excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function handleCreatePage() {
    try {
      const nextPos = pages.length
        ? Math.max(...pages.map((p) => p.position)) + 1
        : 0;
      const page = await createPage.mutateAsync({
        title: 'Nova página',
        position: nextPos,
      });
      setPageId(page.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function handleDeletePage(id: string) {
    try {
      await deletePage.mutateAsync(id);
      toast.success('Página excluída.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function move(page: NotebookPageRow, dir: -1 | 1) {
    const idx = pages.findIndex((p) => p.id === page.id);
    const neighbour = pages[idx + dir];
    if (!neighbour) return;
    try {
      await reorderPage.mutateAsync({ page, neighbour });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reordenar.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '60rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>Caderno</h1>
        <Button
          onClick={handleCreateNotebook}
          loading={createNotebook.isPending}
        >
          Novo caderno
        </Button>
      </header>

      {notebooksQuery.isLoading && <Spinner size={28} />}
      {notebooksQuery.isError && (
        <ErrorText>
          {formatError(
            notebooksQuery.error,
            'Não foi possível carregar seus cadernos',
          )}
        </ErrorText>
      )}

      {notebooks.length === 0 && !notebooksQuery.isLoading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Crie seu primeiro caderno para começar a anotar.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(14rem, 18rem) 1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {/* Sidebar: notebooks + pages */}
          <aside style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Cadernos
              </span>
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setNotebookId(nb.id)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      padding: '0.45rem 0.6rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background:
                        nb.id === notebookId
                          ? 'var(--brand-purple)'
                          : 'var(--color-surface)',
                      color: nb.id === notebookId ? '#fff' : 'inherit',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {nb.title}
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir caderno ${nb.title}`}
                    onClick={() => handleDeleteNotebook(nb.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>

            {notebookId && (
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Páginas
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCreatePage}
                    loading={createPage.isPending}
                  >
                    + Página
                  </Button>
                </div>
                {pagesQuery.isLoading && <Spinner size={18} />}
                {pages.map((pg, i) => (
                  <div
                    key={pg.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPageId(pg.id)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '0.4rem 0.55rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background:
                          pg.id === pageId
                            ? 'rgba(91,42,134,0.1)'
                            : 'var(--color-surface)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      {pg.title}
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para cima"
                      disabled={i === 0}
                      onClick={() => move(pg, -1)}
                      style={ghostIconStyle}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para baixo"
                      disabled={i === pages.length - 1}
                      onClick={() => move(pg, 1)}
                      style={ghostIconStyle}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Editor */}
          <div>
            {activePage ? (
              <PageEditor
                key={activePage.id}
                page={activePage}
                notebookId={notebookId ?? undefined}
                onDelete={() => handleDeletePage(activePage.id)}
              />
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>
                Selecione ou crie uma página.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ghostIconStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  width: '1.6rem',
  height: '1.6rem',
  cursor: 'pointer',
};

function PageEditor({
  page,
  notebookId,
  onDelete,
}: {
  page: NotebookPageRow;
  notebookId: string | undefined;
  onDelete: () => void;
}) {
  const toast = useToast();
  const savePage = useSavePage(notebookId);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content ?? '');

  async function save() {
    try {
      await savePage.mutateAsync({ id: page.id, title, content });
      toast.success('Página salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        background: 'var(--color-surface)',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <Input
        label="Título da página"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Conteúdo</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="Escreva suas anotações aqui…"
          style={{
            padding: '0.6rem 0.7rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            font: 'inherit',
            resize: 'vertical',
            minHeight: '14rem',
          }}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button onClick={save} loading={savePage.isPending}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          Excluir página
        </Button>
      </div>
    </div>
  );
}

export default NotebookPage;
