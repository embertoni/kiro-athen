import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';

/**
 * Forgot-password page. Sends a recovery email via
 * supabase.auth.resetPasswordForEmail with a redirect to /reset-password.
 */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao enviar o e-mail de recuperação.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Verifique seu e-mail"
        footer={<Link to="/login">Voltar para o login</Link>}
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Se existir uma conta associada a <strong>{email}</strong>, enviamos um
          link para redefinir sua senha.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
      footer={<Link to="/login">Voltar para o login</Link>}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
      >
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} fullWidth>
          Enviar link
        </Button>
      </form>
    </AuthCard>
  );
}

export default ForgotPasswordPage;
