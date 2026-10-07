/**
 * FriendsCourseRanking — friends ranking for a SPECIFIC course, by PAC/division.
 *
 * Per the spec this uses friends' PAC/division for the course being viewed (NOT
 * global XP) and has NO weekly period/reset. Values come from the
 * friends_course_pac RPC (server-authoritative); divisions are rendered via the
 * mirrored pacDisplay helper for labels/colors only.
 */

import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useFriendsCoursePac } from './api';
import { pacDisplay, sortByPacDesc } from '@/features/rooms/helpers';

interface FriendsCourseRankingProps {
  courseId: string | null | undefined;
  title?: string;
}

export function FriendsCourseRanking({
  courseId,
  title = 'Ranking de amigos (por PAC)',
}: FriendsCourseRankingProps) {
  const query = useFriendsCoursePac(courseId);

  if (!courseId) return null;

  const rows = sortByPacDesc(
    (query.data ?? []).map((r) => ({
      ...r,
      name: r.displayName || r.username,
    })),
  );

  return (
    <section style={{ display: 'grid', gap: '0.6rem' }}>
      <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{title}</h2>
      <p
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
        }}
      >
        Comparação de desempenho (PAC) entre você e seus amigos neste curso.
      </p>

      {query.isLoading && <Spinner size={24} />}
      {query.isError && (
        <ErrorText>Não foi possível carregar o ranking de amigos.</ErrorText>
      )}

      {query.data && (
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '0.35rem',
          }}
        >
          {rows.map((r, i) => {
            const d = pacDisplay(r.pac, r.division);
            return (
              <li
                key={r.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${r.isSelf ? 'var(--brand-purple)' : 'var(--color-border)'}`,
                  background: r.isSelf
                    ? 'rgba(91, 42, 134, 0.07)'
                    : 'var(--color-surface)',
                }}
              >
                <span
                  style={{
                    width: '1.5rem',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: 'var(--brand-purple)',
                  }}
                >
                  {i + 1}
                </span>
                <strong style={{ flex: 1, minWidth: 0 }}>
                  {r.name}
                  {r.isSelf && (
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        fontWeight: 400,
                      }}
                    >
                      {' '}
                      (você)
                    </span>
                  )}
                </strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: d.color,
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                  }}
                >
                  {d.division}
                </span>
                <strong style={{ width: '3.5rem', textAlign: 'right' }}>
                  {d.label}
                </strong>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li style={{ color: 'var(--color-text-muted)' }}>
              Sem dados de amigos para este curso ainda.
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

export default FriendsCourseRanking;
