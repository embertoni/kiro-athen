import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';

interface LocationState {
  from?: { pathname?: string };
}

/**
 * Login page. A single identifier field accepts an email OR a username
 * (resolved to its email server-side before signInWithPassword). Shows loading
 * and error states and redirects to /dashboard (or the attempted route) on
 * success.
 */
export function LoginPage() {
  const { session, loading, signInWithEmailOrUsername } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const redirectTo =
    (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailOrUsername({ identifier, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Usuário ou senha inválidos.',
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Entrar"
      subtitle="Use seu e-mail ou nome de usuário."
      footer={
        <>
          Não tem conta? <Link to="/register">Criar conta</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <Input
          label="E-mail ou nome de usuário"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div style={{ textAlign: 'right' }}>
          <Link to="/forgot-password" style={{ fontSize: '0.85rem' }}>
            Esqueci minha senha
          </Link>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} fullWidth>
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}

export default LoginPage;
