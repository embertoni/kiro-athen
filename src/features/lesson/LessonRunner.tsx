/**
 * LessonRunner — the reusable lesson-doing UI.
 *
 * Renders the lesson's textual content then its questions in order. The user
 * answers every question (a lesson is complete when all are answered — there is
 * no minimum score). On "Finalizar" the client inserts an attempt + raw answers
 * and calls the server-authoritative finalize_attempt RPC; the server totals
 * (correct_count / total_count / xp_earned) are then displayed. A finalized
 * attempt is immutable; the user can "Refazer aula" to start a fresh attempt.
 *
 * This component is intentionally container-agnostic: it renders only the inner
 * runner (header + content + questions + footer) and NO page/overlay chrome, so
 * it can live BOTH inside the /lesson/:id route (LessonView) AND inside the
 * dashboard's lesson pop-up Modal. A `roomId` may be passed for room-context
 * attempts (FEAT-006), and an `onCompleted` callback fires after a successful
 * finalize so a host (e.g. the dashboard) can react (the trail refetch is
 * already wired via react-query invalidation in useFinalizeLesson).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import type { QuestionRow } from '@/types/db';
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

export interface LessonRunnerProps {
  /** The lesson to run (route :id param, or the clicked trail node id). */
  lessonId: string | undefined;
  /** Room context for room-internal attempts; omit for a course attempt. */
  roomId?: string;
  /** Fires after a successful finalize with the server totals. */
  onCompleted?: (result: AttemptResult) => void;
  /**
   * Called when the user chooses to leave the finished lesson ("Concluir").
   * The route uses it to navigate; the modal uses it to close.
   */
  onDone?: () => void;
}

export function LessonRunner({
  lessonId,
  roomId,
  onCompleted,
  onDone,
}: LessonRunnerProps) {
  const toast = useToast();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const lessonQuery = useLessonWithQuestions(lessonId);
  const finalize = useFinalizeLesson();

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = lessonQuery.data;
  const questions = useMemo<QuestionRow[]>(
    () => data?.questions ?? [],
    [data],
  );

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
      onCompleted?.(totals);
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

  if (lessonQuery.isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  if (lessonQuery.isError) {
    return (
      <ErrorText>
        {formatError(lessonQuery.error, 'Não foi possível carregar a aula')}
      </ErrorText>
    );
  }

  if (!data) return null;

  return (
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
          {roomId && (
            <span style={{ color: 'var(--brand-purple)' }}>
              {' '}
              · Contexto: sala
            </span>
          )}
        </p>
        <h1 style={{ margin: '0.2rem 0 0', color: 'var(--brand-purple)' }}>
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
            <Button variant="primary" onClick={() => onDone?.()}>
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

export default LessonRunner;
