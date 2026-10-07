/**
 * SettingsPage (/settings) — account preferences.
 *
 * - Identity: persist display name + username.
 * - Email: request a change (Supabase sends a confirmation link).
 * - Password: change requiring the current password (reauth then update).
 * - Notification preferences: per-type toggles persisted on the profile.
 * - Danger zone: deactivate/anonymize the account (soft delete) after typing
 *   the exact username to confirm. No hard cascade delete.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { NOTIFICATION_TYPE_LABELS } from '@/domain/constants';
import {
  useChangeEmail,
  useChangePassword,
  useDeactivateAccount,
  useUpdateIdentity,
  useUpdatePreferences,
} from './api';
import {
  confirmsUsername,
  isPreferenceEnabled,
  isValidEmail,
  isValidUsername,
  PREFERENCE_KEYS,
  validatePasswordChange,
  type PreferenceKey,
} from './helpers';

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.1rem',
        background: 'var(--color-surface)',
        display: 'grid',
        gap: '0.8rem',
      }}
    >
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? '';

  if (!profile) {
    return <ErrorText>Carregando perfil…</ErrorText>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '42rem' }}>
      <header>
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
          Configurações
        </h1>
      </header>

      <IdentitySection
        userId={userId}
        initialDisplayName={profile.display_name}
        initialUsername={profile.username}
        onSaved={refreshProfile}
      />
      <EmailSection currentEmail={email} />
      <PasswordSection email={email} />
      <PreferencesSection
        userId={userId}
        prefs={profile.notification_preferences}
        onSaved={refreshProfile}
      />
      <DangerZone username={profile.username} />
    </div>
  );
}

function IdentitySection({
  userId,
  initialDisplayName,
  initialUsername,
  onSaved,
}: {
  userId: string | undefined;
  initialDisplayName: string;
  initialUsername: string;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const update = useUpdateIdentity(userId);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!displayName.trim()) {
      setError('O nome de exibição não pode ficar vazio.');
      return;
    }
    if (!isValidUsername(username)) {
      setError('Usuário inválido (3-30 letras, números ou _).');
      return;
    }
    try {
      await update.mutateAsync({ displayName, username });
      await onSaved();
      toast.success('Dados atualizados.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card title="Identidade">
      <Input
        label="Nome de exibição"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Input
        label="Nome de usuário"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <div>
        <Button onClick={save} loading={update.isPending}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const toast = useToast();
  const change = useChangeEmail();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    try {
      await change.mutateAsync(email);
      toast.success(
        'Enviamos um link de confirmação. A troca só vale após confirmar.',
      );
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar troca.');
    }
  }

  return (
    <Card title="E-mail">
      <p
        style={{
          margin: 0,
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
        }}
      >
        E-mail atual: <strong>{currentEmail || '—'}</strong>
      </p>
      <Input
        label="Novo e-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
      />
      <ErrorText>{error}</ErrorText>
      <div>
        <Button onClick={save} loading={change.isPending}>
          Solicitar troca de e-mail
        </Button>
      </div>
    </Card>
  );
}

function PasswordSection({ email }: { email: string }) {
  const toast = useToast();
  const change = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setError(validation);
    if (validation) return;
    try {
      await change.mutateAsync({ email, currentPassword, newPassword });
      toast.success('Senha alterada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar a senha.');
    }
  }

  return (
    <Card title="Senha">
      <Input
        label="Senha atual"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
      />
      <Input
        label="Nova senha"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
      />
      <Input
        label="Confirmar nova senha"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
      />
      <ErrorText>{error}</ErrorText>
      <div>
        <Button onClick={save} loading={change.isPending}>
          Alterar senha
        </Button>
      </div>
    </Card>
  );
}

function PreferencesSection({
  userId,
  prefs,
  onSaved,
}: {
  userId: string | undefined;
  prefs: Record<string, boolean> | null | undefined;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const update = useUpdatePreferences(userId);
  const initial = useMemo(() => {
    const map: Record<PreferenceKey, boolean> = {} as Record<
      PreferenceKey,
      boolean
    >;
    for (const key of PREFERENCE_KEYS) {
      map[key] = isPreferenceEnabled(prefs, key);
    }
    return map;
  }, [prefs]);
  const [state, setState] = useState(initial);

  function toggle(key: PreferenceKey) {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    try {
      await update.mutateAsync({ ...state });
      await onSaved();
      toast.success('Preferências salvas.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card title="Preferências de notificação">
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {PREFERENCE_KEYS.map((key) => (
          <label
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <input
              type="checkbox"
              checked={state[key]}
              onChange={() => toggle(key)}
            />
            {NOTIFICATION_TYPE_LABELS[key]}
          </label>
        ))}
      </div>
      <div>
        <Button onClick={save} loading={update.isPending}>
          Salvar preferências
        </Button>
      </div>
    </Card>
  );
}

function DangerZone({ username }: { username: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const deactivate = useDeactivateAccount();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    if (!confirmsUsername(confirmText, username)) {
      setError('Digite seu nome de usuário exatamente para confirmar.');
      return;
    }
    try {
      await deactivate.mutateAsync();
      toast.success('Conta desativada.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar.');
    }
  }

  return (
    <Card title="Zona de perigo">
      <p
        style={{
          margin: 0,
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
        }}
      >
        Desativar sua conta remove seus dados pessoais (nome, bio, avatar) e
        encerra o acesso. Seu histórico de estudo é preservado de forma anônima;
        nada é apagado em cascata.
      </p>
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Desativar conta
        </Button>
      </div>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          size="md"
          title="Desativar conta"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={confirm}
                loading={deactivate.isPending}
                disabled={!confirmsUsername(confirmText, username)}
              >
                Desativar definitivamente
              </Button>
            </>
          }
        >
          <p>
            Para confirmar, digite seu nome de usuário{' '}
            <strong>{username}</strong> abaixo.
          </p>
          <Input
            label="Nome de usuário"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          <ErrorText>{error}</ErrorText>
        </Modal>
      )}
    </Card>
  );
}

export default SettingsPage;
