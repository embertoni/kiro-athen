/**
 * Global ranking page — all-time leaderboard ordered by XP / level.
 *
 * Authenticated-only (routed under ProtectedRoute). There is NO weekly period,
 * reset, or "Top da semana" anywhere: this is a single all-time ordering read
 * from the server-authoritative global_ranking view.
 */

import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGlobalRanking } from './api';

export function GlobalRankingPage() {
  const { session } = useAuth();
  const myId = session?.user?.id;
  const query = useGlobalRanking(50);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '48rem' }}>
      <header>
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
          Ranking global
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>
          Classificação geral por XP acumulado. Sem período semanal.
        </p>
      </header>

      {query.isLoading && (
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
        >
          <Spinner size={32} />
        </div>
      )}
      {query.isError && (
        <ErrorText>
          {formatError(query.error, 'Não foi possível carregar o ranking')}
        </ErrorText>
      )}

      {query.data && (
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '0.4rem',
          }}
        >
          {query.data.map((row) => {
            const isMe = row.userId === myId;
            return (
              <li
                key={row.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isMe ? 'var(--brand-purple)' : 'var(--color-border)'}`,
                  background: isMe
                    ? 'rgba(91, 42, 134, 0.07)'
                    : 'var(--color-surface)',
                }}
              >
                <span
                  style={{
                    width: '2rem',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: 'var(--brand-purple)',
                  }}
                >
                  {row.position}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>
                    {row.displayName || row.username}
                    {isMe && (
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
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    @{row.username} · 🔥 {row.streakCount}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: 'var(--brand-purple)' }}>
                    {row.xpGlobal.toLocaleString('pt-BR')} XP
                  </strong>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Nível {row.level}
                  </div>
                </div>
              </li>
            );
          })}
          {query.data.length === 0 && (
            <li style={{ color: 'var(--color-text-muted)' }}>
              Ainda não há jogadores no ranking.
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

export default GlobalRankingPage;
