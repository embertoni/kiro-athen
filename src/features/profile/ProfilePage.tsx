/**
 * ProfilePage — own profile (editable) and third-party profiles (read-only).
 *
 * Resolved by the optional :username route param. When no param is present it
 * shows the current user's own profile; the viewer can edit display name, bio,
 * avatar (Supabase Storage upload with a URL fallback), banner, and pick up to
 * 3 featured medals. Shows username, display name, avatar, bio, banner, streak,
 * XP, level, medals, enrolled-courses count and friends count.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  uploadAvatar,
  useProfile,
  useSetFeaturedMedals,
  useUpdateProfile,
  type ProfileMedal,
  type ProfileView,
} from './api';

const BANNER_GRADIENT =
  'linear-gradient(120deg, var(--brand-purple), var(--brand-gold))';

export function ProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const viewerId = session?.user?.id;
  const query = useProfile(username, viewerId);
  const [editOpen, setEditOpen] = useState(false);
  const [medalsOpen, setMedalsOpen] = useState(false);

  if (query.isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}
      >
        <Spinner size={32} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorText>Perfil não encontrado.</ErrorText>;
  }

  const view = query.data;
  const p = view.profile;
  const featuredMedals = view.medals.filter((m) => m.award.featured);
  const banner = p.banner_url
    ? { backgroundImage: `url(${p.banner_url})`, backgroundSize: 'cover' }
    : { background: BANNER_GRADIENT };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '52rem' }}>
      {/* Banner + avatar + identity */}
      <section
        style={{
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ height: '8rem', ...banner }} />
        <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative' }}>
          <div
            style={{
              width: '5rem',
              height: '5rem',
              borderRadius: '50%',
              marginTop: '-2.5rem',
              border: '3px solid var(--color-surface)',
              background: p.avatar_url
                ? `url(${p.avatar_url}) center/cover`
                : 'var(--brand-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.8rem',
              fontWeight: 700,
            }}
            aria-hidden={!!p.avatar_url}
          >
            {!p.avatar_url &&
              (p.display_name || p.username).charAt(0).toUpperCase()}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              marginTop: '0.5rem',
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
                {p.display_name}
              </h1>
              <div style={{ color: 'var(--color-text-muted)' }}>
                @{p.username}
              </div>
            </div>
            {view.isOwner && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  Editar perfil
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMedalsOpen(true)}
                >
                  Destacar medalhas
                </Button>
              </div>
            )}
          </div>

          {p.bio && (
            <p style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {p.bio}
            </p>
          )}

          {/* Level / XP / streak inline, inside the identity block */}
          <div
            style={{
              display: 'flex',
              gap: '1.25rem',
              flexWrap: 'wrap',
              marginTop: '0.9rem',
            }}
          >
            <InlineStat label="Nível" value={p.level} />
            <InlineStat
              label="XP"
              value={p.xp_global.toLocaleString('pt-BR')}
            />
            <InlineStat label="Sequência" value={`${p.streak_count} 🔥`} />
          </div>

          {/* Cursos / Amigos as clickable controls */}
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
              marginTop: '0.9rem',
            }}
          >
            <CountButton
              label="Cursos"
              value={view.enrolledCount}
              ariaLabel={`Cursos: ${view.enrolledCount}. Ir para o catálogo`}
              onClick={() => navigate('/catalog')}
            />
            <CountButton
              label="Amigos"
              value={view.friendsCount}
              ariaLabel={`Amigos: ${view.friendsCount}. Ir para amigos`}
              onClick={() => navigate('/friends')}
            />
          </div>

          {/* Featured medals pinned into the identity block */}
          {featuredMedals.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                flexWrap: 'wrap',
                marginTop: '0.9rem',
              }}
            >
              {featuredMedals.map((m) => (
                <MedalChip
                  key={`featured-${m.medal.code}`}
                  medal={m}
                  highlight
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All medals */}
      <MedalsShowcase medals={view.medals} />

      {editOpen && view.isOwner && (
        <EditProfileModal
          view={view}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await refreshProfile();
            await query.refetch();
          }}
        />
      )}

      {medalsOpen && view.isOwner && (
        <FeatureMedalsModal
          medals={view.medals}
          userId={viewerId}
          onClose={() => setMedalsOpen(false)}
          onSaved={async () => {
            setMedalsOpen(false);
            await query.refetch();
          }}
        />
      )}
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        {label}
      </div>
    </div>
  );
}

function CountButton({
  label,
  value,
  ariaLabel,
  onClick,
}: {
  label: string;
  value: string | number;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.5rem 0.85rem',
        background: 'var(--color-surface)',
        color: 'var(--brand-purple)',
        font: 'inherit',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: '0.85rem' }}>{label}</span>
    </button>
  );
}

function MedalsShowcase({ medals }: { medals: ProfileMedal[] }) {
  return (
    <section style={{ display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Medalhas</h2>
      {medals.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Nenhuma medalha conquistada ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {medals.map((m) => (
            <MedalChip key={`all-${m.medal.code}`} medal={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function MedalChip({
  medal,
  highlight,
}: {
  medal: ProfileMedal;
  highlight?: boolean;
}) {
  return (
    <div
      title={medal.medal.description}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.45rem 0.7rem',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${highlight ? 'var(--brand-gold-dark)' : 'var(--color-border)'}`,
        background: highlight
          ? 'rgba(255, 193, 7, 0.12)'
          : 'var(--color-surface)',
      }}
    >
      <span style={{ fontSize: '1.2rem' }} aria-hidden>
        {medal.medal.icon ?? '🏅'}
      </span>
      <strong style={{ fontSize: '0.85rem' }}>{medal.medal.name}</strong>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit profile modal
// ---------------------------------------------------------------------------

function EditProfileModal({
  view,
  onClose,
  onSaved,
}: {
  view: ProfileView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const p = view.profile;
  const update = useUpdateProfile(p.id);

  const [displayName, setDisplayName] = useState(p.display_name);
  const [bio, setBio] = useState(p.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(p.avatar_url ?? '');
  const [bannerUrl, setBannerUrl] = useState(p.banner_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(p.id, file);
      setAvatarUrl(url);
      toast.success('Avatar enviado.');
    } catch {
      // Storage may not be configured — fall back to the URL field.
      setError(
        'Não foi possível enviar o arquivo. Cole uma URL de imagem no campo abaixo.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!displayName.trim()) {
      setError('O nome de exibição não pode ficar vazio.');
      return;
    }
    try {
      await update.mutateAsync({
        displayName,
        bio,
        avatarUrl: avatarUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
      });
      toast.success('Perfil atualizado.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar perfil"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <Input
          label="Nome de exibição"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            style={{
              padding: '0.5rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              font: 'inherit',
              resize: 'vertical',
            }}
          />
        </label>

        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Avatar</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarFile}
            disabled={uploading}
          />
          {uploading && <Spinner size={18} label="Enviando" />}
          <Input
            label="…ou cole uma URL de imagem"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <Input
          label="Banner (URL de imagem, opcional)"
          value={bannerUrl}
          onChange={(e) => setBannerUrl(e.target.value)}
          placeholder="https://… (vazio usa o gradiente padrão)"
        />

        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Feature-medals modal (choose up to 3)
// ---------------------------------------------------------------------------

function FeatureMedalsModal({
  medals,
  userId,
  onClose,
  onSaved,
}: {
  medals: ProfileMedal[];
  userId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const save = useSetFeaturedMedals(userId);
  const initial = useMemo(
    () => medals.filter((m) => m.award.featured).map((m) => m.medal.code),
    [medals],
  );
  const [selected, setSelected] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: string) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 3) {
        setError('Você pode destacar no máximo 3 medalhas.');
        return prev;
      }
      return [...prev, code];
    });
  }

  async function handleSave() {
    try {
      await save.mutateAsync(selected);
      toast.success('Medalhas em destaque atualizadas.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Destacar medalhas (até 3)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      {medals.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Conquiste medalhas para poder destacá-las.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {medals.map((m) => {
            const checked = selected.includes(m.medal.code);
            return (
              <label
                key={m.medal.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.7rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${checked ? 'var(--brand-gold-dark)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.medal.code)}
                />
                <span aria-hidden style={{ fontSize: '1.1rem' }}>
                  {m.medal.icon ?? '🏅'}
                </span>
                <span>{m.medal.name}</span>
              </label>
            );
          })}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

export default ProfilePage;
