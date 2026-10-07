/**
 * RoomsListPage (/rooms) — the learner's and educator's room hub.
 *
 * - Educators create a room linked to one of their own courses (course must
 *   belong to them; also enforced by RLS).
 * - Anyone joins a room by access code (or a copyable link's ?join=<code>) via
 *   the join_room RPC — no email required.
 * - Lists the user's rooms split into "as educator" and "as member".
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCreateRoom,
  useJoinByCode,
  useMyCoursesForRoom,
  useMyRooms,
  type RoomSummary,
} from './api';
import { normalizeAccessCode } from './helpers';

export function RoomsListPage() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const roomsQuery = useMyRooms(userId);
  const joinMutation = useJoinByCode();

  const isEducator = profile?.role === 'educator' || profile?.role === 'admin';

  const [joinCode, setJoinCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Prefill the join code when arriving via a copyable link (?join=CODE).
  useEffect(() => {
    const fromLink = searchParams.get('join');
    if (fromLink) {
      setJoinCode(normalizeAccessCode(fromLink));
    }
  }, [searchParams]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeAccessCode(joinCode);
    if (!code) return;
    try {
      await joinMutation.mutateAsync(code);
      toast.success('Você entrou na sala! Abra-a na lista abaixo.');
      setJoinCode('');
      // Clear the ?join param so a refresh does not re-trigger.
      if (searchParams.get('join')) {
        searchParams.delete('join');
        setSearchParams(searchParams, { replace: true });
      }
      await roomsQuery.refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível entrar.',
      );
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '56rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>Salas</h1>
          <p
            style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}
          >
            Estude em salas com desempenho, ranking e PAC isolados do seu perfil
            global.
          </p>
        </div>
        {isEducator && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Criar sala
          </Button>
        )}
      </header>

      {/* Join by code */}
      <section
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          background: 'var(--color-surface)',
        }}
      >
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Entrar com um código</h2>
        <form
          onSubmit={handleJoin}
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <Input
              label="Código de acesso"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeAccessCode(e.target.value))}
              placeholder="Ex.: ABC-DEF"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            loading={joinMutation.isPending}
            disabled={!joinCode}
          >
            Entrar
          </Button>
        </form>
      </section>

      {roomsQuery.isLoading && (
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}
        >
          <Spinner size={32} />
        </div>
      )}
      {roomsQuery.isError && (
        <ErrorText>Não foi possível carregar suas salas.</ErrorText>
      )}

      {roomsQuery.data && (
        <>
          {isEducator && (
            <RoomGroup
              title="Salas que você administra"
              rooms={roomsQuery.data.asEducator}
              emptyText="Você ainda não criou nenhuma sala."
              onOpen={(id) => navigate(`/rooms/${id}`)}
            />
          )}
          <RoomGroup
            title="Salas em que você participa"
            rooms={roomsQuery.data.asMember}
            emptyText="Você ainda não entrou em nenhuma sala. Use um código acima."
            onOpen={(id) => navigate(`/rooms/${id}`)}
          />
        </>
      )}

      {createOpen && (
        <CreateRoomModal
          userId={userId}
          onClose={() => setCreateOpen(false)}
          onCreated={(roomId) => {
            setCreateOpen(false);
            navigate(`/rooms/${roomId}`);
          }}
        />
      )}
    </div>
  );
}

function RoomGroup({
  title,
  rooms,
  emptyText,
  onOpen,
}: {
  title: string;
  rooms: RoomSummary[];
  emptyText: string;
  onOpen: (roomId: string) => void;
}) {
  return (
    <section>
      <h2 style={{ fontSize: '1.1rem' }}>{title}</h2>
      {rooms.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {rooms.map((r) => (
            <button
              key={r.room.id}
              type="button"
              onClick={() => onOpen(r.room.id)}
              style={{
                textAlign: 'left',
                width: '100%',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.8rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{r.room.name}</strong>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {r.courseTitle ?? 'Sem curso vinculado'} · {r.memberCount}{' '}
                  membro(s)
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--brand-purple)',
                  fontWeight: 600,
                }}
              >
                {r.relation === 'educator' ? 'Administrador' : 'Participante'}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CreateRoomModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string | undefined;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const toast = useToast();
  const coursesQuery = useMyCoursesForRoom(userId);
  const createMutation = useCreateRoom(userId);

  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const courses = coursesQuery.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Dê um nome à sala.');
      return;
    }
    if (!courseId) {
      setError('Selecione um curso que você criou.');
      return;
    }
    try {
      const room = await createMutation.mutateAsync({
        name: name.trim(),
        courseId,
      });
      toast.success('Sala criada!');
      onCreated(room.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar a sala.',
      );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Criar sala"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending}>
            Criar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
        <Input
          label="Nome da sala"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Turma A - Matemática"
        />
        {coursesQuery.isLoading ? (
          <Spinner size={20} />
        ) : courses.length === 0 ? (
          <ErrorText>
            Você precisa criar um curso antes de abrir uma sala.
          </ErrorText>
        ) : (
          <Select
            label="Curso vinculado"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={[
              { value: '', label: 'Selecione um curso…' },
              ...courses.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
        )}
        <ErrorText>{error}</ErrorText>
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
          }}
        >
          Um código de acesso será gerado automaticamente. Você poderá
          regenerá-lo ou desativá-lo depois.
        </p>
      </form>
    </Modal>
  );
}

export default RoomsListPage;
