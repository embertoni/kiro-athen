import { useParams } from 'react-router-dom';

interface PlaceholderPageProps {
  /** Human-readable page name shown in the heading. */
  title: string;
  /** Short pt-BR description of what this page will contain. */
  description?: string;
}

/**
 * Clearly-labelled placeholder for pages whose features are implemented in
 * later tasks. Keeps the router wired and the app compiling today. Shows any
 * route params so navigation (e.g. /lesson/:id) is visibly working.
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([, v]) => v != null);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '40rem',
      }}
    >
      <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>{title}</h1>
      <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
        {description ?? 'Esta área será implementada em uma etapa posterior.'}
      </p>
      {paramEntries.length > 0 && (
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
          }}
        >
          Parâmetros da rota:{' '}
          {paramEntries.map(([k, v]) => `${k}=${v}`).join(', ')}
        </p>
      )}
    </section>
  );
}

export default PlaceholderPage;
