import { Link, Navigate } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Public landing page. Athen branding, purple/gold hero, a pt-BR value
 * proposition and CTAs to login/register. Signed-in users are sent to the
 * dashboard.
 */
export function LandingPage() {
  const { session, loading } = useAuth();

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
        }}
      >
        <BrandMark size={36} />
        <nav style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">
              Criar conta
            </Button>
          </Link>
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          background:
            'radial-gradient(circle at 50% 0%, rgba(91,42,134,0.08), transparent 60%)',
        }}
      >
        <Logo size={96} title="Athen" />
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            color: 'var(--brand-purple)',
          }}
        >
          Aprenda em equipe. Evolua jogando.
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: '38rem',
            fontSize: '1.1rem',
            color: 'var(--color-text-muted)',
          }}
        >
          A Athen é a plataforma colaborativa de aprendizado com cursos
          interativos, salas de estudo, gamificação com XP, níveis e divisões,
          e amigos para manter sua rotina de estudos em dia.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register">
            <Button variant="primary" size="lg">
              Começar agora
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="lg">
              Já tenho conta
            </Button>
          </Link>
        </div>
      </main>

      <footer
        style={{
          padding: '1rem 1.5rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
        }}
      >
        Athen — plataforma colaborativa de aprendizado.
      </footer>
    </div>
  );
}

export default LandingPage;
