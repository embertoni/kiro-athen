/**
 * Lesson runner — an overlay page (per spec: "popup/página sobreposta").
 *
 * Renders the lesson's textual content then its questions in order. The user
 * answers every question (a lesson is complete when all are answered — there is
 * no minimum score). On "Finalizar" the client inserts an attempt + raw answers
 * and calls the server-authoritative finalize_attempt RPC; the server totals
 * (correct_count / total_count / xp_earned) are then displayed. A finalized
 * attempt is immutable; the user can "Refazer aula" to start a fresh attempt.
 *
 * Context: by default this is a COURSE-context attempt (the lesson's owning
 * course), which adds to global XP + enrollment progress. A roomId may be
 * passed via the `?room=` query param so FEAT-006 (salas) can reuse this exact
 * view for room-context attempts that stay internal to the room.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import type { QuestionRow } from '@/types/database';
import type {
  AttemptResult,
  FillBlankConfig,
  FillBlankSubmitted,
  MatchConfig,
  MatchSubmitted,
  MultipleChoiceConfig,
  MultipleChoiceSubmitted,
  SubmittedAnswer,
  SumAlternativesConfig,
  SumAlternativesSubmitted,
} from '@/types/domain';
import {
  useFinalizeLesson,
  useLessonWithQuestions,
  type AttemptContext,
  type SubmittedEntry,
} from './api';
import {
  FillBlankQuestion,
  MatchQuestion,
  MultipleChoiceQuestion,
  SumAlternativesQuestion,
} from './questions/QuestionComponents';

type AnswerMap = Record<string, SubmittedAnswer | null>;

export function LessonView() {
  const { id: lessonId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room') ?? undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const lessonQuery = useLessonWithQuestions(lessonId);
  const finalize = useFinalizeLesson();

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = lessonQuery.data;
  const questions = data?.questions ?? [];

  const allAnswered = useMemo(
    () =>
      questions.length > 0 && questions.every((q) => isAnswered(answers[q.id])),
    [questions, answers],
  );

  function setAnswer(questionId: string, submitted: SubmittedAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: submitted }));
  }

  async function handleFinalize() {
    if (!userId || !lessonId || !data) return;
    if (!allAnswered) {
      toast.error('Responda todas as questões antes de finalizar.');
      return;
    }
    setError(null);

    const context: AttemptContext = roomId
      ? { roomId, courseId: data.courseId }
      : { courseId: data.courseId };

    const entries: SubmittedEntry[] = questions.map((q) => ({
      questionId: q.id,
      submitted: answers[q.id] as SubmittedAnswer,
    }));

    try {
      const totals = await finalize.mutateAsync({
        userId,
        lessonId,
        context,
        entries,
      });
      setResult(totals);
      toast.success(`Aula concluída! +${totals.xpEarned} XP`);
    } catch (err) {
      setError(formatError(err, 'Não foi possível finalizar a aula'));
    }
  }

  function handleRedo() {
    // A finalized attempt is immutable; redoing starts a brand-new attempt.
    setAnswers({});
    setResult(null);
    setError(null);
  }

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
            justifyContent: 'space-between',
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
          {roomId && (
            <span style={{ fontSize: '0.8rem', color: 'var(--brand-purple)' }}>
              Contexto: sala
            </span>
          )}
        </div>

        {lessonQuery.isLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '2rem',
            }}
          >
            <Spinner size={32} />
          </div>
        )}

        {lessonQuery.isError && (
          <ErrorText>
            {formatError(lessonQuery.error, 'Não foi possível carregar a aula')}
          </ErrorText>
        )}

        {data && (
          <>
            <header style={{ marginBottom: '1rem' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                {data.courseTitle} · {data.module.title}
              </p>
              <h1
                style={{ margin: '0.2rem 0 0', color: 'var(--brand-purple)' }}
              >
                {data.lesson.title}
              </h1>
            </header>

            {data.lesson.content && (
              <section
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  marginBottom: '1.5rem',
                }}
              >
                {data.lesson.content}
              </section>
            )}

            {questions.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>
                Esta aula não tem questões.
              </p>
            ) : (
              <ol
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: '1.25rem',
                }}
              >
                {questions.map((q, index) => (
                  <li key={q.id}>
                    <QuestionItem
                      index={index}
                      question={q}
                      value={answers[q.id] ?? null}
                      onChange={(s) => setAnswer(q.id, s)}
                      result={result}
                    />
                  </li>
                ))}
              </ol>
            )}

            {error && (
              <div style={{ marginTop: '1rem' }}>
                <ErrorText>{error}</ErrorText>
              </div>
            )}

            <footer
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {result ? (
                <>
                  <div style={{ flex: 1, minWidth: '12rem' }}>
                    <strong style={{ color: 'var(--brand-purple)' }}>
                      {result.correctCount}/{result.totalCount} corretas
                    </strong>{' '}
                    · <strong>+{result.xpEarned} XP</strong>
                    <p
                      style={{
                        margin: '0.2rem 0 0',
                        fontSize: '0.78rem',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Totais calculados pelo servidor.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={handleRedo}>
                    Refazer aula
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => navigate('/dashboard')}
                  >
                    Concluir
                  </Button>
                </>
              ) : (
                questions.length > 0 && (
                  <Button
                    variant="primary"
                    disabled={!allAnswered}
                    loading={finalize.isPending}
                    onClick={handleFinalize}
                  >
                    Finalizar aula
                  </Button>
                )
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/** True when a submitted payload is "answered enough" to finalize. */
function isAnswered(submitted: SubmittedAnswer | null | undefined): boolean {
  if (!submitted) return false;
  if ('selected' in submitted) return submitted.selected.length > 0;
  if ('text' in submitted) return submitted.text.trim().length > 0;
  if ('sum' in submitted) return true; // 0 is a valid sum
  if ('pairs' in submitted) return submitted.pairs.length > 0;
  return false;
}

interface QuestionItemProps {
  index: number;
  question: QuestionRow;
  value: SubmittedAnswer | null;
  onChange: (submitted: SubmittedAnswer) => void;
  /** When set, the attempt was finalized and inputs become read-only. */
  result: AttemptResult | null;
}

/** Renders a single question with its type-specific input. */
function QuestionItem({
  index,
  question,
  value,
  onChange,
  result,
}: QuestionItemProps) {
  const disabled = result !== null;
  const header = (
    <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
      {index + 1}. {question.prompt}
    </p>
  );

  let input: React.ReactNode = null;
  switch (question.type) {
    case 'multiple_choice':
      input = (
        <MultipleChoiceQuestion
          config={question.config as unknown as MultipleChoiceConfig}
          value={value as MultipleChoiceSubmitted | null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'fill_blank':
      input = (
        <FillBlankQuestion
          config={question.config as unknown as FillBlankConfig}
          value={value as FillBlankSubmitted | null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'sum_alternatives':
      input = (
        <SumAlternativesQuestion
          config={question.config as unknown as SumAlternativesConfig}
          value={value as SumAlternativesSubmitted | null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'match':
      input = (
        <MatchQuestion
          config={question.config as unknown as MatchConfig}
          value={value as MatchSubmitted | null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    default:
      input = null;
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.9rem 1rem',
      }}
    >
      {header}
      {input}
    </div>
  );
}

export default LessonView;
