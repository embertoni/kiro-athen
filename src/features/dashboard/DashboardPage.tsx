/**
 * Dashboard — the learner's home.
 *
 * Shows real, server-authoritative state: global XP, level and division, course
 * enrollments with their progress bars, the module/lesson trail (with sequential
 * locking) for the selected course, a "Continuar" shortcut that resumes the last
 * studied lesson, and a link into the notebook. There is no temporary/visual-only
 * completion state — everything comes from enrollments/completions/attempts.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useAuth } from '@/features/auth/AuthProvider';
import { divisionForPac, levelForXp } from '@/domain/rules';
import { MedalsPanel } from '@/features/gamification/MedalsPanel';
import { FriendsCourseRanking } from '@/features/rankings/FriendsCourseRanking';
import {
  useCourseTrail,
  useDashboardOverview,
  type DashboardEnrollment,
} from './api';

export function DashboardPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;

  const overviewQuery = useDashboardOverview(userId);
  const overview = overviewQuery.data;

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Default the trail to the last studied course, else the first enrollment.
  useEffect(() => {
    if (selectedCourseId || !overview) return;
    const next =
      overview.lastStudied?.courseId ??
      overview.enrollments[0]?.course.id ??
      null;
    if (next) setSelectedCourseId(next);
  }, [overview, selectedCourseId]);

  const trailQuery = useCourseTrail(userId, selectedCourseId);

  const liveProfile = overview?.profile ?? profile;
  const xp = liveProfile?.xp_global ?? 0;
  const level = liveProfile?.level ?? levelForXp(xp);

  function handleContinue() {
    if (overview?.lastStudied) {
      navigate(`/lesson/${overview.lastStudied.lessonId}`);
      return;
    }
    // No prior attempt: start the first lesson of the first unlocked trail item.
    const firstLesson = trailQuery.data?.modules
      .flatMap((m) => m.lessons)
      .find((l) => !l.locked);
    if (firstLesson) navigate(`/lesson/${firstLesson.lesson.id}`);
  }

  if (overviewQuery.isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}
      >
        <Spinner size={36} />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return <ErrorText>Não foi possível carregar o painel.</ErrorText>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '60rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
            Olá,{' '}
            {liveProfile?.display_name || liveProfile?.username || 'estudante'}!
          </h1>
          <p
            style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}
          >
            Continue de onde parou e acompanhe seu progresso.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={!overview?.lastStudied && !trailQuery.data}
        >
          {overview?.lastStudied ? 'Continuar' : 'Começar a estudar'}
        </Button>
      </header>

      {/* Stats */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '0.75rem',
        }}
      >
        <StatCard label="XP global" value={xp.toLocaleString('pt-BR')} />
        <StatCard label="Nível" value={String(level)} />
        <StatCard
          label="Sequência"
          value={`${liveProfile?.streak_count ?? 0} dias`}
        />
        <StatCard
          label="Divisão (média)"
          value={averageDivision(overview?.enrollments ?? [])}
        />
      </section>

      {overview?.lastStudied && (
        <section
          style={{
            background: 'rgba(91, 42, 134, 0.06)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Última aula estudada
            </p>
            <strong>{overview.lastStudied.lessonTitle}</strong>
            {overview.lastStudied.courseTitle && (
              <span style={{ color: 'var(--color-text-muted)' }}>
                {' '}
                · {overview.lastStudied.courseTitle}
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={handleContinue}>
            Retomar
          </Button>
        </section>
      )}

      {/* Enrollments */}
      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Meus cursos</h2>
        {!overview?.enrollments.length ? (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Você ainda não está matriculado.{' '}
            <Link to="/catalog">Explore o catálogo</Link>.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {overview.enrollments.map((e) => (
              <EnrollmentRowCard
                key={e.enrollment.id}
                data={e}
                active={selectedCourseId === e.course.id}
                onSelect={() => setSelectedCourseId(e.course.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Trail for selected course */}
      {selectedCourseId && (
        <section>
          <h2 style={{ fontSize: '1.1rem' }}>
            Trilha {trailQuery.data ? `· ${trailQuery.data.courseTitle}` : ''}
          </h2>
          {trailQuery.isLoading && <Spinner size={24} />}
          {trailQuery.isError && (
            <ErrorText>Não foi possível carregar a trilha.</ErrorText>
          )}
          {trailQuery.data && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {trailQuery.data.modules.map((m) => (
                <div
                  key={m.module.id}
                  style={{
                    borderLeft: `3px solid ${m.module.color ?? '#5b2a86'}`,
                    paddingLeft: '0.75rem',
                  }}
                >
                  <strong>{m.module.title}</strong>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '0.4rem 0 0',
                      padding: 0,
                      display: 'grid',
                      gap: '0.3rem',
                    }}
                  >
                    {m.lessons.map((l) => (
                      <li key={l.lesson.id}>
                        <button
                          type="button"
                          disabled={l.locked}
                          onClick={() => navigate(`/lesson/${l.lesson.id}`)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.7rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: l.completed
                              ? 'rgba(46, 160, 67, 0.08)'
                              : 'var(--color-surface)',
                            cursor: l.locked ? 'not-allowed' : 'pointer',
                            opacity: l.locked ? 0.55 : 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{l.lesson.title}</span>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {l.locked
                              ? '🔒 Bloqueada'
                              : l.completed
                                ? '✓ Concluída'
                                : 'Disponível'}
                          </span>
                        </button>
                      </li>
                    ))}
                    {m.lessons.length === 0 && (
                      <li
                        style={{
                          color: 'var(--color-text-muted)',
                          fontSize: '0.9rem',
                        }}
                      >
                        Sem aulas neste módulo.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Friends ranking for the selected course (PAC/division, not global XP) */}
      {selectedCourseId && <FriendsCourseRanking courseId={selectedCourseId} />}

      {/* Medals (server-granted) + streak */}
      <MedalsPanel userId={userId} streakCount={liveProfile?.streak_count} />

      {/* Notebook entry */}
      <section
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>Caderno</strong>
          <p
            style={{
              margin: '0.2rem 0 0',
              fontSize: '0.9rem',
              color: 'var(--color-text-muted)',
            }}
          >
            Suas anotações de estudo em um só lugar.
          </p>
        </div>
        <Link to="/notebook">
          <Button variant="ghost" size="sm">
            Abrir caderno
          </Button>
        </Link>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.8rem 1rem',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.78rem',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </p>
      <strong style={{ fontSize: '1.3rem', color: 'var(--brand-purple)' }}>
        {value}
      </strong>
    </div>
  );
}

function EnrollmentRowCard({
  data,
  active,
  onSelect,
}: {
  data: DashboardEnrollment;
  active: boolean;
  onSelect: () => void;
}) {
  const progress = Math.round(data.enrollment.progress);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        width: '100%',
        background: 'var(--color-surface)',
        border: `1px solid ${active ? 'var(--brand-purple)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        cursor: 'pointer',
        display: 'grid',
        gap: '0.4rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <strong>{data.course.title}</strong>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {progress}%
        </span>
      </div>
      <div
        style={{
          height: '0.5rem',
          borderRadius: '999px',
          background: 'var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            background: 'var(--brand-purple)',
          }}
        />
      </div>
    </button>
  );
}

/**
 * Non-authoritative display helper: approximate the user's division from their
 * average course progress. The server owns the real PAC/division per context.
 */
function averageDivision(enrollments: DashboardEnrollment[]): string {
  if (enrollments.length === 0) return '—';
  const avg =
    enrollments.reduce((acc, e) => acc + (e.enrollment.progress ?? 0), 0) /
    enrollments.length;
  return divisionForPac(avg);
}

export default DashboardPage;
