import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';

/**
 * Reset-password page. Supabase delivers the recovery link to this route; the
 * client (configured with detectSessionInUrl) establishes a short-lived
 * recovery session, after which updateUser({ password }) sets the new password.
 */
export function ResetPasswordPage() {
  const { session, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Give the client a moment to parse the recovery token from the URL.
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setCheckingSession(false), 1200);
    return () => window.clearTimeout(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Senha redefinida" footer={<Link to="/login">Ir para o login</Link>}>
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Sua senha foi atualizada. Redirecionando para o login...
        </p>
      </AuthCard>
    );
  }

  if (!checkingSession && !session) {
    return (
      <AuthCard
        title="Link inválido ou expirado"
        footer={<Link to="/forgot-password">Solicitar novo link</Link>}
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Não foi possível validar o link de recuperação. Solicite um novo
          e-mail para redefinir sua senha.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Redefinir senha" subtitle="Escolha uma nova senha para sua conta.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <Input
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} fullWidth>
          Redefinir senha
        </Button>
      </form>
    </AuthCard>
  );
}

export default ResetPasswordPage;
