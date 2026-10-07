import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useAddComment,
  useCourseDetail,
  useEnroll,
  useMyEnrollmentForCourse,
  useUpsertReview,
} from './api';

interface CourseDetailModalProps {
  /** Course id to show, or null to keep the modal closed. */
  courseId: string | null;
  onClose: () => void;
}

/** Simple 0-5 star picker. */
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Avaliação"
      style={{ display: 'flex', gap: '0.2rem' }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            lineHeight: 1,
            color:
              n <= value ? 'var(--brand-gold-dark)' : 'var(--color-border)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Large overlay popup with full course details and actions (enroll, start,
 * rate 0-5, comment). Built on the shared Modal — intentionally NOT a route.
 */
export function CourseDetailModal({
  courseId,
  onClose,
}: CourseDetailModalProps) {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const userId = session?.user?.id;

  const detailQuery = useCourseDetail(courseId);
  const enrollmentQuery = useMyEnrollmentForCourse(userId, courseId);
  const enroll = useEnroll();
  const upsertReview = useUpsertReview();
  const addComment = useAddComment();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const detail = detailQuery.data;
  const enrolled = !!enrollmentQuery.data;

  async function handleEnroll() {
    if (!userId || !courseId) return;
    setActionError(null);
    try {
      await enroll.mutateAsync({ userId, courseId });
      toast.success('Matrícula realizada!');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Não foi possível matricular.',
      );
    }
  }

  function handleStart() {
    if (!detail?.firstLessonId) {
      toast.error('Este curso ainda não tem aulas.');
      return;
    }
    onClose();
    navigate(`/lesson/${detail.firstLessonId}`);
  }

  async function handleRate() {
    if (!userId || !courseId || rating === 0) return;
    setActionError(null);
    try {
      await upsertReview.mutateAsync({ userId, courseId, rating });
      toast.success('Avaliação registrada!');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Não foi possível avaliar.',
      );
    }
  }

  async function handleComment() {
    if (!userId || !courseId || !comment.trim()) return;
    setActionError(null);
    try {
      await addComment.mutateAsync({
        authorId: userId,
        courseId,
        content: comment.trim(),
      });
      setComment('');
      toast.success('Comentário publicado!');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Não foi possível comentar.',
      );
    }
  }

  const totalLessons = detail
    ? detail.modules.reduce((acc, m) => acc + m.lessons.length, 0)
    : 0;

  return (
    <Modal
      open={!!courseId}
      onClose={onClose}
      size="lg"
      title={detail?.course.title ?? 'Carregando curso...'}
      footer={
        detail ? (
          <>
            {enrolled ? (
              <Button variant="primary" onClick={handleStart}>
                Começar curso
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={enroll.isPending}
                onClick={handleEnroll}
              >
                Matricular
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </>
        ) : undefined
      }
    >
      {detailQuery.isLoading && (
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
        >
          <Spinner size={32} />
        </div>
      )}

      {detailQuery.isError && (
        <ErrorText>Não foi possível carregar o curso.</ErrorText>
      )}

      {detail && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* Banner */}
          <div
            style={{
              height: '7rem',
              borderRadius: 'var(--radius-md)',
              background: detail.course.cover_url
                ? `center / cover no-repeat url(${detail.course.cover_url})`
                : 'linear-gradient(120deg, var(--brand-purple), var(--brand-purple-light))',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <span
              style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}
            >
              /{detail.course.slug}
            </span>
            <span style={{ fontSize: '0.85rem' }}>
              por{' '}
              <strong>
                {detail.creator?.display_name ??
                  detail.creator?.username ??
                  'Desconhecido'}
              </strong>
            </span>
            <span
              style={{ fontSize: '0.85rem', color: 'var(--brand-gold-dark)' }}
            >
              ★ {detail.averageRating.toFixed(1)} ({detail.reviewCount})
            </span>
            <span
              style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}
            >
              {detail.studentCount}{' '}
              {detail.studentCount === 1 ? 'aluno' : 'alunos'}
            </span>
            <span
              style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}
            >
              {totalLessons} {totalLessons === 1 ? 'aula' : 'aulas'}
            </span>
          </div>

          {detail.course.description && (
            <p style={{ margin: 0 }}>{detail.course.description}</p>
          )}

          {/* Modules & lessons */}
          <section>
            <h3 style={{ marginBottom: '0.5rem' }}>Conteúdo</h3>
            {detail.modules.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>
                Sem módulos ainda.
              </p>
            )}
            {detail.modules.map((m) => (
              <div
                key={m.module.id}
                style={{
                  borderLeft: `3px solid ${m.module.color ?? '#5b2a86'}`,
                  paddingLeft: '0.75rem',
                  marginBottom: '0.6rem',
                }}
              >
                <strong>{m.module.title}</strong>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>
                  {m.lessons.map((l) => (
                    <li key={l.lesson.id} style={{ fontSize: '0.9rem' }}>
                      {l.lesson.title}{' '}
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        ({l.questions.length}{' '}
                        {l.questions.length === 1 ? 'questão' : 'questões'})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {/* Rate */}
          {enrolled && (
            <section
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '0.75rem',
              }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>Sua avaliação</h3>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <StarRating value={rating} onChange={setRating} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={rating === 0}
                  loading={upsertReview.isPending}
                  onClick={handleRate}
                >
                  Enviar
                </Button>
              </div>
            </section>
          )}

          {/* Comments */}
          <section
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '0.75rem',
            }}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>Comentários recentes</h3>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escreva um comentário..."
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                }}
              />
              <Button
                size="sm"
                disabled={!comment.trim()}
                loading={addComment.isPending}
                onClick={handleComment}
              >
                Comentar
              </Button>
            </div>
            {detail.recentComments.length === 0 ? (
              <p
                style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}
              >
                Seja o primeiro a comentar.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: '0.5rem',
                }}
              >
                {detail.recentComments.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem 0.75rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.85rem' }}>
                      {c.author?.display_name ??
                        c.author?.username ??
                        'Usuário'}
                    </strong>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {actionError && <ErrorText>{actionError}</ErrorText>}
        </div>
      )}
    </Modal>
  );
}

export default CourseDetailModal;
