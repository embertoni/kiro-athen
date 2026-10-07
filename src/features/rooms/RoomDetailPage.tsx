/**
 * RoomDetailPage (/rooms/:id) — a room with isolated context.
 *
 * Tabs:
 *  - Conteúdo: the linked course's modules/lessons, launched in ROOM context
 *    via /lesson/:id?room=<roomId> (XP/PAC/progress stay internal to the room).
 *  - Membros:  educator manages (add/remove, retain history); students see the
 *    roster per the PAC visibility permission.
 *  - Avisos:   classroom board with full history (educator posts).
 *  - Missões:  internal-XP missions with participant progress.
 *  - Ranking:  internal ranking by xp_internal among ACTIVE members (no weekly).
 *  - PAC/Divisão: each member's internal PAC + division (visibility rules apply).
 *
 * Authority is server-side (RLS/RPCs); the UI only reflects permissions.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import type { PacVisibility, RoomRow } from '@/types/database';
import {
  pacDisplay,
  sortByXpDesc,
  buildRoomJoinLink,
  formatAccessCode,
} from './helpers';
import {
  useAddMember,
  useAnnouncements,
  useCreateAnnouncement,
  useCreateMission,
  useMissions,
  useRegenerateCode,
  useRemoveMember,
  useRoomContent,
  useRoomDetail,
  useRoomMembers,
  useSetCodeActive,
  useSetPacVisibility,
  type RoomMemberView,
} from './api';

type Tab = 'content' | 'members' | 'announcements' | 'missions' | 'ranking' | 'pac';

const TAB_LABELS: Record<Tab, string> = {
  content: 'Conteúdo',
  members: 'Membros',
  announcements: 'Avisos',
  missions: 'Missões',
  ranking: 'Ranking',
  pac: 'PAC / Divisão',
};

export function RoomDetailPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const detailQuery = useRoomDetail(roomId, userId);
  const [tab, setTab] = useState<Tab>('content');

  if (detailQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size={36} />
      </div>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorText>Não foi possível carregar a sala.</ErrorText>;
  }

  const { room, course, isEducator } = detailQuery.data;

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '56rem' }}>
      <header>
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>{room.name}</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>
          {course?.title ?? 'Sem curso vinculado'} ·{' '}
          {isEducator ? 'Você administra esta sala' : 'Você participa desta sala'}
        </p>
      </header>

      {isEducator && <EducatorCodePanel room={room} />}

      {/* Tabs */}
      <nav
        role="tablist"
        style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)' }}
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0.5rem 0.8rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: tab === t ? 'var(--brand-purple)' : 'var(--color-text-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--brand-purple)' : 'transparent'}`,
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {tab === 'content' && (
        <ContentTab roomId={room.id} courseId={room.course_id} />
      )}
      {tab === 'members' && (
        <MembersTab roomId={room.id} isEducator={isEducator} />
      )}
      {tab === 'announcements' && (
        <AnnouncementsTab roomId={room.id} isEducator={isEducator} userId={userId} />
      )}
      {tab === 'missions' && (
        <MissionsTab roomId={room.id} isEducator={isEducator} userId={userId} />
      )}
      {tab === 'ranking' && <RankingTab roomId={room.id} />}
      {tab === 'pac' && (
        <PacTab roomId={room.id} room={room} isEducator={isEducator} userId={userId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Educator access-code panel
// ---------------------------------------------------------------------------

function EducatorCodePanel({ room }: { room: RoomRow }) {
  const toast = useToast();
  const regenerate = useRegenerateCode(room.id);
  const setActive = useSetCodeActive(room.id);

  const link = buildRoomJoinLink(room.access_code);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard?.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <section
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        background: 'var(--color-surface)',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            Código de acesso {room.code_active ? '(ativo)' : '(inativo)'}
          </p>
          <strong style={{ fontSize: '1.3rem', letterSpacing: '0.1em', color: 'var(--brand-purple)' }}>
            {formatAccessCode(room.access_code)}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button size="sm" variant="ghost" onClick={() => copy(room.access_code, 'Código')}>
            Copiar código
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copy(link, 'Link')}>
            Copiar link
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={regenerate.isPending}
            onClick={async () => {
              try {
                await regenerate.mutateAsync();
                toast.success('Novo código gerado.');
              } catch {
                toast.error('Não foi possível regenerar.');
              }
            }}
          >
            Regenerar
          </Button>
          <Button
            size="sm"
            variant={room.code_active ? 'danger' : 'primary'}
            loading={setActive.isPending}
            onClick={async () => {
              try {
                await setActive.mutateAsync(!room.code_active);
                toast.success(room.code_active ? 'Código desativado.' : 'Código ativado.');
              } catch {
                toast.error('Não foi possível atualizar.');
              }
            }}
          >
            {room.code_active ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
        Link de entrada: {link}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo tab — launch lessons in ROOM context
// ---------------------------------------------------------------------------

function ContentTab({ roomId, courseId }: { roomId: string; courseId: string | null }) {
  const navigate = useNavigate();
  const contentQuery = useRoomContent(courseId);

  if (!courseId) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Esta sala não tem curso vinculado.</p>;
  }
  if (contentQuery.isLoading) return <Spinner size={24} />;
  if (contentQuery.isError) return <ErrorText>Não foi possível carregar o conteúdo.</ErrorText>;

  const modules = contentQuery.data ?? [];

  return (
    <section style={{ display: 'grid', gap: '0.9rem' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        As aulas estudadas aqui contam apenas para o seu desempenho interno da sala
        (XP, PAC e progresso), nunca para o XP global.
      </p>
      {modules.map((m) => (
        <div key={m.id} style={{ borderLeft: `3px solid ${m.color ?? '#5b2a86'}`, paddingLeft: '0.75rem' }}>
          <strong>{m.title}</strong>
          <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0, display: 'grid', gap: '0.3rem' }}>
            {m.lessons.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/lesson/${l.id}?room=${roomId}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    cursor: 'pointer',
                  }}
                >
                  {l.title}
                </button>
              </li>
            ))}
            {m.lessons.length === 0 && (
              <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Sem aulas.</li>
            )}
          </ul>
        </div>
      ))}
      {modules.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>O curso ainda não tem módulos.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Membros tab
// ---------------------------------------------------------------------------

function MembersTab({ roomId, isEducator }: { roomId: string; isEducator: boolean }) {
  const toast = useToast();
  const membersQuery = useRoomMembers(roomId, false);
  const addMember = useAddMember(roomId);
  const removeMember = useRemoveMember(roomId);
  const [username, setUsername] = useState('');

  if (membersQuery.isLoading) return <Spinner size={24} />;
  if (membersQuery.isError) return <ErrorText>Não foi possível carregar os membros.</ErrorText>;

  const members = membersQuery.data ?? [];
  const active = members.filter((m) => m.member.status === 'active');
  const removed = members.filter((m) => m.member.status === 'removed');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      await addMember.mutateAsync(username.trim());
      toast.success('Membro adicionado.');
      setUsername('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar.');
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      {isEducator && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <Input
              label="Adicionar por usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nome de usuário"
              autoComplete="off"
            />
          </div>
          <Button type="submit" loading={addMember.isPending} disabled={!username.trim()}>
            Adicionar
          </Button>
        </form>
      )}

      <div>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          Membros ativos ({active.length})
        </h3>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {active.map((m) => (
            <MemberRow
              key={m.member.id}
              data={m}
              canRemove={isEducator}
              removing={removeMember.isPending}
              onRemove={async () => {
                try {
                  await removeMember.mutateAsync(m.member.id);
                  toast.success('Membro removido (histórico mantido).');
                } catch {
                  toast.error('Não foi possível remover.');
                }
              }}
            />
          ))}
          {active.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)' }}>Nenhum membro ativo ainda.</p>
          )}
        </div>
      </div>

      {isEducator && removed.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
            Removidos ({removed.length}) · histórico mantido
          </h3>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {removed.map((m) => (
              <MemberRow key={m.member.id} data={m} canRemove={false} removing={false} onRemove={() => {}} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MemberRow({
  data,
  canRemove,
  removing,
  onRemove,
}: {
  data: RoomMemberView;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const name = data.profile?.display_name || data.profile?.username || 'Usuário';
  const isRemoved = data.member.status === 'removed';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.8rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        opacity: isRemoved ? 0.6 : 1,
      }}
    >
      <strong style={{ flex: 1, minWidth: 0 }}>
        {name}
        {data.profile?.username && (
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            {' '}@{data.profile.username}
          </span>
        )}
      </strong>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        {data.member.xp_internal} XP interno
      </span>
      {canRemove && !isRemoved && (
        <Button size="sm" variant="danger" loading={removing} onClick={onRemove}>
          Remover
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avisos tab
// ---------------------------------------------------------------------------

function AnnouncementsTab({
  roomId,
  isEducator,
  userId,
}: {
  roomId: string;
  isEducator: boolean;
  userId: string | undefined;
}) {
  const toast = useToast();
  const query = useAnnouncements(roomId);
  const create = useCreateAnnouncement(roomId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    try {
      await create.mutateAsync({ authorId: userId, title: title.trim(), content });
      toast.success('Aviso publicado.');
      setTitle('');
      setContent('');
    } catch {
      toast.error('Não foi possível publicar.');
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      {isEducator && (
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: '0.5rem' }}>
          <Input label="Título do aviso" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Conteúdo</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '0.95rem',
              resize: 'vertical',
            }}
          />
          <div>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
              Publicar aviso
            </Button>
          </div>
        </form>
      )}

      {query.isLoading && <Spinner size={24} />}
      {query.isError && <ErrorText>Não foi possível carregar os avisos.</ErrorText>}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {(query.data ?? []).map((a) => (
          <article
            key={a.announcement.id}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.8rem 1rem',
              background: 'var(--color-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <strong>{a.announcement.title}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {new Date(a.announcement.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {a.announcement.content && (
              <p style={{ margin: '0.4rem 0 0', whiteSpace: 'pre-wrap' }}>{a.announcement.content}</p>
            )}
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              por {a.authorName}
            </p>
          </article>
        ))}
        {query.data?.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Nenhum aviso ainda.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Missões tab
// ---------------------------------------------------------------------------

function MissionsTab({
  roomId,
  isEducator,
  userId,
}: {
  roomId: string;
  isEducator: boolean;
  userId: string | undefined;
}) {
  const toast = useToast();
  const query = useMissions(roomId);
  const create = useCreateMission(roomId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [rewardXp, setRewardXp] = useState('10');
  const [minCorrect, setMinCorrect] = useState('1');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    try {
      await create.mutateAsync({
        authorId: userId,
        title: title.trim(),
        description,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        rewardXp: Math.max(0, Number(rewardXp) || 0),
        minCorrect: Math.max(0, Number(minCorrect) || 0),
      });
      toast.success('Missão criada.');
      setTitle('');
      setDescription('');
      setDeadline('');
    } catch {
      toast.error('Não foi possível criar a missão.');
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      {isEducator && (
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: '0.5rem' }}>
          <Input label="Título da missão" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '0.95rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Input
              label="Prazo (opcional)"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <Input
              label="XP de recompensa (interno)"
              type="number"
              min={0}
              value={rewardXp}
              onChange={(e) => setRewardXp(e.target.value)}
            />
            <Input
              label="Mín. de acertos"
              type="number"
              min={0}
              value={minCorrect}
              onChange={(e) => setMinCorrect(e.target.value)}
            />
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            A recompensa é XP interno da sala — não afeta o XP global.
          </p>
          <div>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
              Criar missão
            </Button>
          </div>
        </form>
      )}

      {query.isLoading && <Spinner size={24} />}
      {query.isError && <ErrorText>Não foi possível carregar as missões.</ErrorText>}
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {(query.data ?? []).map((m) => (
          <article
            key={m.mission.id}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.8rem 1rem',
              background: 'var(--color-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong>{m.mission.title}</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--brand-purple)', fontWeight: 600 }}>
                +{m.mission.reward_xp} XP interno
              </span>
            </div>
            {m.mission.description && (
              <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>{m.mission.description}</p>
            )}
            <div style={{ display: 'flex', gap: '1rem', margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <span>Mín. acertos: {m.mission.min_correct}</span>
              {m.mission.deadline && (
                <span>Prazo: {new Date(m.mission.deadline).toLocaleDateString('pt-BR')}</span>
              )}
            </div>
            {m.participants.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.2rem' }}>
                {m.participants.map((p) => (
                  <li key={p.userId} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.name}</span>
                    <span style={{ color: p.completed ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {p.completed ? '✓ Concluída' : `${Math.round(p.progress)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {query.data?.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma missão ainda.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ranking tab (internal by xp_internal, active members only, no weekly)
// ---------------------------------------------------------------------------

function RankingTab({ roomId }: { roomId: string }) {
  const query = useRoomMembers(roomId, true);

  if (query.isLoading) return <Spinner size={24} />;
  if (query.isError) return <ErrorText>Não foi possível carregar o ranking.</ErrorText>;

  const ranked = sortByXpDesc(
    (query.data ?? []).map((m) => ({
      ...m,
      xp: m.member.xp_internal,
      name: m.profile?.display_name || m.profile?.username || 'Usuário',
    })),
  );

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        Classificação interna por XP da sala (apenas membros ativos). Sem período semanal.
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
        {ranked.map((m, i) => (
          <li
            key={m.member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}
          >
            <span style={{ width: '1.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--brand-purple)' }}>
              {i + 1}
            </span>
            <strong style={{ flex: 1, minWidth: 0 }}>{m.name}</strong>
            <span style={{ color: 'var(--brand-purple)', fontWeight: 600 }}>
              {m.member.xp_internal} XP
            </span>
          </li>
        ))}
        {ranked.length === 0 && (
          <li style={{ color: 'var(--color-text-muted)' }}>Sem membros ativos no ranking.</li>
        )}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PAC / Divisão tab
// ---------------------------------------------------------------------------

const PAC_VISIBILITY_OPTIONS: { value: PacVisibility; label: string }[] = [
  { value: 'members', label: 'Visível a todos os participantes' },
  { value: 'educator_only', label: 'Visível apenas ao educador' },
  { value: 'public', label: 'Público' },
];

function PacTab({
  roomId,
  room,
  isEducator,
  userId,
}: {
  roomId: string;
  room: RoomRow;
  isEducator: boolean;
  userId: string | undefined;
}) {
  const toast = useToast();
  const query = useRoomMembers(roomId, true);
  const setVisibility = useSetPacVisibility(roomId);

  if (query.isLoading) return <Spinner size={24} />;
  if (query.isError) return <ErrorText>Não foi possível carregar o PAC.</ErrorText>;

  const members = query.data ?? [];

  // Visibility rules: the educator always sees everyone; a student always sees
  // their own row; whether a student sees OTHER students' PAC depends on the
  // room-level pac_visibility column (see findings — per-member visibility is
  // not modeled in the MVP schema, so this is room-level).
  const canSeeOthers =
    isEducator || room.pac_visibility === 'members' || room.pac_visibility === 'public';

  const visibleMembers = members.filter(
    (m) => canSeeOthers || m.member.user_id === userId,
  );

  return (
    <section style={{ display: 'grid', gap: '0.9rem' }}>
      {isEducator && (
        <div style={{ maxWidth: '24rem' }}>
          <Select
            label="Visibilidade do PAC dos participantes"
            value={room.pac_visibility}
            options={PAC_VISIBILITY_OPTIONS}
            onChange={async (e) => {
              try {
                await setVisibility.mutateAsync(e.target.value as PacVisibility);
                toast.success('Visibilidade atualizada.');
              } catch {
                toast.error('Não foi possível atualizar.');
              }
            }}
          />
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            O educador sempre vê o PAC de todos; cada aluno sempre vê o próprio.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {visibleMembers.map((m) => {
          const name = m.profile?.display_name || m.profile?.username || 'Usuário';
          const d = pacDisplay(m.member.pac_internal);
          return (
            <div
              key={m.member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.8rem',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${m.member.user_id === userId ? 'var(--brand-purple)' : 'var(--color-border)'}`,
                background: 'var(--color-surface)',
              }}
            >
              <strong style={{ flex: 1, minWidth: 0 }}>
                {name}
                {m.member.user_id === userId && (
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (você)</span>
                )}
              </strong>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#fff',
                  background: d.color,
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {d.division}
              </span>
              <strong style={{ width: '4rem', textAlign: 'right' }}>{d.label}</strong>
            </div>
          );
        })}
        {visibleMembers.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Sem dados de PAC ainda.</p>
        )}
      </div>
    </section>
  );
}

export default RoomDetailPage;
