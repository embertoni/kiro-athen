import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';

/** 404 fallback for unknown routes. */
export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <BrandMark size={48} />
      <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>Página não encontrada</h1>
      <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
        O endereço que você acessou não existe.
      </p>
      <Link to="/">
        <Button variant="primary">Voltar ao início</Button>
      </Link>
    </div>
  );
}

export default NotFoundPage;
