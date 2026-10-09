/**
 * LessonView — the /lesson/:id route.
 *
 * A thin wrapper around the reusable {@link LessonRunner}: it reads the lesson
 * id from the route params (and an optional `?room=` context), renders the
 * runner inside a fixed full-screen overlay surface above the app shell, and
 * handles route-level navigation (back / done).
 *
 * The same LessonRunner is rendered by the dashboard inside a Modal pop-up, so
 * the lesson behavior (content, 4 question types, server-authoritative
 * finalize_attempt, results, "Refazer aula") lives in ONE place and both entry
 * points stay in sync.
 */

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LessonRunner } from './LessonRunner';

export function LessonView() {
  const { id: lessonId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room') ?? undefined;
  const navigate = useNavigate();

  // Overlay page: fixed full-screen surface above the app shell.
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 26, 40, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        overflowY: 'auto',
        padding: '1.5rem',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          maxWidth: '48rem',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            ← Voltar
          </button>
        </div>

        <LessonRunner
          lessonId={lessonId}
          roomId={roomId}
          onDone={() => navigate('/dashboard')}
        />
      </div>
    </div>
  );
}

export default LessonView;
