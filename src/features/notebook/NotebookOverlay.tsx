/**
 * NotebookOverlay — a floating, draggable + resizable notebook panel.
 *
 * This is an ADDITIONAL surface for the personal notebook that floats above the
 * page (the full /notebook page and the "Cadernos" sidebar nav item stay as the
 * primary surface). It is a NON-modal panel (aria-modal="false") so the page
 * underneath stays interactive while the overlay is open.
 *
 * The drag + resize interaction model is modeled on the reference overlay in
 * _ref-athen (reference only), but reimplemented here with OUR CSS-variable
 * styling (.nb-overlay* in theme.css) and OUR notebook data hooks from ./api.
 * All on-screen clamping and resize math lives in the pure, unit-tested helpers
 * in ./overlayGeometry so the component itself stays thin.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
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
  useSavePage,
} from './api';
import {
  clampPosition,
  computeResize,
  type Point,
  type ResizeDirection,
  type Size,
} from './overlayGeometry';

const RESIZE_DIRECTIONS: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

type NotebookOverlayProps = {
  onClose: () => void;
};

export function NotebookOverlay({ onClose }: NotebookOverlayProps) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const toast = useToast();

  const notebooksQuery = useNotebooks(userId);
  const createNotebook = useCreateNotebook(userId);
  const deleteNotebook = useDeleteNotebook(userId);

  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const notebooks = useMemo(
    () => notebooksQuery.data ?? [],
    [notebooksQuery.data],
  );

  // Default to the first notebook once loaded.
  useEffect(() => {
    if (!notebookId && notebooks.length > 0) {
      setNotebookId(notebooks[0].id);
    }
  }, [notebooks, notebookId]);

  const pagesQuery = useNotebookPages(notebookId ?? undefined);
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const createPage = useCreatePage(notebookId ?? undefined);
  const deletePage = useDeletePage(notebookId ?? undefined);

  // Default to the first page of the selected notebook.
  useEffect(() => {
    if (pages.length === 0) {
      setPageId(null);
    } else if (!pages.some((p) => p.id === pageId)) {
      setPageId(pages[0].id);
    }
  }, [pages, pageId]);

  const activePage = pages.find((p) => p.id === pageId) ?? null;

  // ----- Floating geometry (position + size) -----
  const initialSize: Size = { width: 440, height: 420 };
  const [size, setSize] = useState<Size>(initialSize);
  const [position, setPosition] = useState<Point>(() => {
    if (typeof window === 'undefined') return { x: 120, y: 100 };
    return clampPosition(
      {
        x: Math.round((window.innerWidth - initialSize.width) / 2),
        y: Math.round((window.innerHeight - initialSize.height) / 3),
      },
      initialSize,
      { width: window.innerWidth, height: window.innerHeight },
    );
  });

  // Imperative drag/resize state kept in refs so the window listeners read the
  // latest values without re-subscribing on every move.
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const resizeRef = useRef({
    active: false,
    direction: 'se' as ResizeDirection,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
  });

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      if (dragRef.current.active) {
        setSize((currentSize) => {
          setPosition(
            clampPosition(
              {
                x: event.clientX - dragRef.current.offsetX,
                y: event.clientY - dragRef.current.offsetY,
              },
              currentSize,
              viewport,
            ),
          );
          return currentSize;
        });
      }

      if (resizeRef.current.active) {
        const r = resizeRef.current;
        const { size: nextSize, position: nextPosition } = computeResize({
          direction: r.direction,
          deltaX: event.clientX - r.startX,
          deltaY: event.clientY - r.startY,
          startLeft: r.startLeft,
          startTop: r.startTop,
          startWidth: r.startWidth,
          startHeight: r.startHeight,
        });
        setSize(nextSize);
        setPosition(clampPosition(nextPosition, nextSize, viewport));
      }
    }

    function handlePointerUp() {
      dragRef.current.active = false;
      resizeRef.current.active = false;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  function startDragging(event: React.PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    // Let header controls (close button) work without starting a drag.
    if (target.closest('button, input, select')) return;
    dragRef.current = {
      active: true,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function startResizing(
    event: React.PointerEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) {
    event.stopPropagation();
    resizeRef.current = {
      active: true,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.x,
      startTop: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  // ----- Data operations (reusing the same hooks as NotebookPage) -----
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

  const compact = size.width <= 320;

  return (
    <section
      className="nb-overlay"
      role="dialog"
      aria-modal="false"
      aria-label="Caderno flutuante"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <header className="nb-overlay__header" onPointerDown={startDragging}>
        <span className="nb-overlay__title">📖 Caderno</span>
        <button
          type="button"
          className="nb-overlay__close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Fechar caderno"
        >
          ✕
        </button>
      </header>

      <div className="nb-overlay__body">
        {notebooksQuery.isLoading && <Spinner size={22} />}
        {notebooksQuery.isError && (
          <ErrorText>
            {formatError(
              notebooksQuery.error,
              'Não foi possível carregar seus cadernos',
            )}
          </ErrorText>
        )}

        {/* Notebook picker + create */}
        <div className="nb-overlay__row">
          <select
            className="nb-overlay__select"
            aria-label="Selecionar caderno"
            value={notebookId ?? ''}
            onChange={(e) => setNotebookId(e.target.value || null)}
          >
            {notebooks.length === 0 && <option value="">Sem cadernos</option>}
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.title}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleCreateNotebook}
            loading={createNotebook.isPending}
          >
            + Caderno
          </Button>
          {notebookId && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Excluir caderno atual"
              onClick={() => handleDeleteNotebook(notebookId)}
            >
              🗑
            </Button>
          )}
        </div>

        {/* Page tabs */}
        {notebookId && (
          <div className="nb-overlay__tabs">
            {pagesQuery.isLoading && <Spinner size={16} />}
            {pages.map((pg) => (
              <button
                key={pg.id}
                type="button"
                title={pg.title}
                onClick={() => setPageId(pg.id)}
                className={
                  pg.id === pageId
                    ? 'nb-overlay__tab nb-overlay__tab--active'
                    : 'nb-overlay__tab'
                }
              >
                {pg.title}
              </button>
            ))}
            <button
              type="button"
              className="nb-overlay__tab nb-overlay__tab--add"
              onClick={handleCreatePage}
              disabled={createPage.isPending}
              aria-label="Nova página"
            >
              +
            </button>
          </div>
        )}

        {/* Editor */}
        <div className="nb-overlay__editor">
          {activePage ? (
            <OverlayPageEditor
              key={activePage.id}
              page={activePage}
              notebookId={notebookId ?? undefined}
              compact={compact}
              onDelete={() => handleDeletePage(activePage.id)}
            />
          ) : (
            <p className="nb-overlay__hint">
              {notebookId
                ? 'Crie uma página para começar suas anotações.'
                : 'Crie ou selecione um caderno.'}
            </p>
          )}
        </div>
      </div>

      {/* 8 resize handles (4 edges + 4 corners). */}
      {RESIZE_DIRECTIONS.map((dir) => (
        <button
          key={dir}
          type="button"
          tabIndex={-1}
          aria-label={`Redimensionar (${dir})`}
          className={`nb-overlay__resize nb-overlay__resize--${dir}`}
          onPointerDown={(e) => startResizing(e, dir)}
        />
      ))}
    </section>
  );
}

function OverlayPageEditor({
  page,
  notebookId,
  compact,
  onDelete,
}: {
  page: NotebookPageRow;
  notebookId: string | undefined;
  compact: boolean;
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
    <div className="nb-overlay__editor-inner">
      <input
        className="nb-overlay__title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da página"
        aria-label="Título da página"
      />
      <textarea
        className="nb-overlay__textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva suas anotações aqui..."
        aria-label="Conteúdo da página"
      />
      <div className="nb-overlay__actions">
        <Button size="sm" onClick={save} loading={savePage.isPending}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          {compact ? 'Excluir' : 'Excluir página'}
        </Button>
      </div>
    </div>
  );
}

export default NotebookOverlay;
