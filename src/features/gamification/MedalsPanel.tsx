/**
 * MedalsPanel — displays the 4 MVP medals (server-granted) plus the streak.
 *
 * Earned medals are highlighted; not-yet-earned ones are dimmed with their
 * unlock description. Values come from the server (user_medals + profiles),
 * never computed on the client.
 */

import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useUserMedals } from './api';

interface MedalsPanelProps {
  userId: string | undefined;
  /** Server-granted streak from profiles.streak_count. */
  streakCount?: number;
}

export function MedalsPanel({ userId, streakCount }: MedalsPanelProps) {
  const query = useUserMedals(userId);

  return (
    <section style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Medalhas</h2>
        {typeof streakCount === 'number' && (
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            🔥 Sequência atual: <strong>{streakCount}</strong> dia(s)
          </span>
        )}
      </div>

      {query.isLoading && <Spinner size={24} />}
      {query.isError && <ErrorText>Não foi possível carregar as medalhas.</ErrorText>}

      {query.data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
            gap: '0.6rem',
          }}
        >
          {query.data.map(({ medal, earned }) => (
            <div
              key={medal.code}
              title={medal.description}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${earned ? 'var(--brand-gold-dark)' : 'var(--color-border)'}`,
                background: earned ? 'rgba(255, 193, 7, 0.12)' : 'var(--color-surface)',
                opacity: earned ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: '1.5rem' }} aria-hidden>
                {medal.icon ?? '🏅'}
              </span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.9rem' }}>{medal.name}</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {earned ? 'Conquistada' : medal.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default MedalsPanel;
