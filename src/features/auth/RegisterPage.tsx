import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import type { SignUpInput } from './AuthProvider';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Estudante' },
  { value: 'educator', label: 'Educador' },
];

/**
 * Register page. Collects username, email, password, confirm password and a
 * role (student/educator; admin is reserved). Validates password == confirm
 * client-side, then signs up passing username/display_name/role as metadata so
 * the handle_new_user() trigger creates the profile. Shows a
 * "confirme seu e-mail" state afterwards.
 */
export function RegisterPage() {
  const { session, loading, signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<SignUpInput['role']>('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate(): string | null {
    if (username.trim().length < 3) {
      return 'O nome de usuário deve ter ao menos 3 caracteres.';
    }
    if (password.length < 6) {
      return 'A senha deve ter ao menos 6 caracteres.';
    }
    if (password !== confirm) {
      return 'As senhas não coincidem.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        username,
        displayName: username.trim(),
        role,
      });
      if (needsEmailConfirmation) {
        setConfirmSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmSent) {
    return (
      <AuthCard
        title="Confirme seu e-mail"
        subtitle="Sua conta foi criada."
        footer={<Link to="/login">Voltar para o login</Link>}
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o
          e-mail e confirme seu endereço para ativar a conta e poder entrar.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Comece a aprender e evoluir na Athen."
      footer={
        <>
          Já tem conta? <Link to="/login">Entrar</Link>
        </>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
      >
        <Input
          label="Nome de usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmar senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Select
          label="Perfil"
          value={role}
          onChange={(e) => setRole(e.target.value as SignUpInput['role'])}
          options={ROLE_OPTIONS}
          hint="O perfil de administrador é reservado."
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={submitting} fullWidth>
          Criar conta
        </Button>
      </form>
    </AuthCard>
  );
}

export default RegisterPage;
