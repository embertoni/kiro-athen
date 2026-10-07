/**
 * FriendsPage (/friends) — user search, the friendship lifecycle, and the
 * "lembrete para estudar" reminder.
 *
 * - Search any user by username/display name and send a request.
 * - Incoming requests can be accepted/declined; outgoing can be cancelled.
 * - Friends can be viewed (profile link), removed, and nudged with a study
 *   reminder (lembrete_estudo notification).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCancelRequest,
  useFriends,
  useRemoveFriend,
  useRespondRequest,
  useSendRequest,
  useSendStudyReminder,
  useUserSearch,
  type FriendEdge,
  type FriendProfile,
} from './api';

export function FriendsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const toast = useToast();

  const friendsQuery = useFriends(userId);
  const sendRequest = useSendRequest(userId);

  const [search, setSearch] = useState('');
  const searchQuery = useUserSearch(search);

  async function handleSend(target: FriendProfile) {
    try {
      await sendRequest.mutateAsync(target.id);
      toast.success(`Pedido enviado para @${target.username}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '46rem' }}>
      <header>
        <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>Amigos</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>
          Encontre pessoas, gerencie pedidos e envie lembretes de estudo.
        </p>
      </header>

      {/* User search */}
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
        <Input
          label="Buscar usuários"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Digite um nome ou @usuário"
          autoComplete="off"
        />
        {search.trim().length >= 2 && (
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {searchQuery.isLoading && <Spinner size={20} />}
            {searchQuery.data && searchQuery.data.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                Nenhum usuário encontrado.
              </p>
            )}
            {searchQuery.data?.map((u) => (
              <PersonRow
                key={u.id}
                profile={u}
                action={
                  <Button
                    size="sm"
                    onClick={() => handleSend(u)}
                    loading={sendRequest.isPending}
                  >
                    Adicionar
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>

      {friendsQuery.isLoading && <Spinner size={28} />}
      {friendsQuery.isError && (
        <ErrorText>Não foi possível carregar seus amigos.</ErrorText>
      )}

      {friendsQuery.data && (
        <>
          <IncomingList edges={friendsQuery.data.incoming} userId={userId} />
          <OutgoingList edges={friendsQuery.data.outgoing} userId={userId} />
          <FriendsList edges={friendsQuery.data.friends} userId={userId} />
        </>
      )}
    </div>
  );
}

function PersonRow({
  profile,
  action,
}: {
  profile: Pick<FriendProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'level'>;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.55rem 0.7rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          width: '2.2rem',
          height: '2.2rem',
          borderRadius: '50%',
          flexShrink: 0,
          background: profile.avatar_url
            ? `url(${profile.avatar_url}) center/cover`
            : 'var(--brand-purple)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {!profile.avatar_url &&
          (profile.display_name || profile.username).charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          to={`/profile/${profile.username}`}
          style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
        >
          {profile.display_name}
        </Link>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          @{profile.username} · Nível {profile.level}
        </div>
      </div>
      {action}
    </div>
  );
}

function IncomingList({
  edges,
  userId,
}: {
  edges: FriendEdge[];
  userId: string | undefined;
}) {
  const toast = useToast();
  const respond = useRespondRequest(userId);
  if (edges.length === 0) return null;

  async function handle(friendshipId: string, accept: boolean) {
    try {
      await respond.mutateAsync({ friendshipId, accept });
      toast.success(accept ? 'Pedido aceito.' : 'Pedido recusado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: '1.05rem' }}>Pedidos recebidos</h2>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {edges.map((e) =>
          e.other ? (
            <PersonRow
              key={e.friendship.id}
              profile={e.other}
              action={
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <Button
                    size="sm"
                    onClick={() => handle(e.friendship.id, true)}
                    loading={respond.isPending}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handle(e.friendship.id, false)}
                  >
                    Recusar
                  </Button>
                </div>
              }
            />
          ) : null,
        )}
      </div>
    </section>
  );
}

function OutgoingList({
  edges,
  userId,
}: {
  edges: FriendEdge[];
  userId: string | undefined;
}) {
  const toast = useToast();
  const cancel = useCancelRequest(userId);
  if (edges.length === 0) return null;

  async function handleCancel(friendshipId: string) {
    try {
      await cancel.mutateAsync(friendshipId);
      toast.success('Pedido cancelado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: '1.05rem' }}>Pedidos enviados</h2>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {edges.map((e) =>
          e.other ? (
            <PersonRow
              key={e.friendship.id}
              profile={e.other}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(e.friendship.id)}
                  loading={cancel.isPending}
                >
                  Cancelar
                </Button>
              }
            />
          ) : null,
        )}
      </div>
    </section>
  );
}

function FriendsList({
  edges,
  userId,
}: {
  edges: FriendEdge[];
  userId: string | undefined;
}) {
  const toast = useToast();
  const remove = useRemoveFriend(userId);
  const remind = useSendStudyReminder();

  async function handleRemove(friendshipId: string) {
    try {
      await remove.mutateAsync(friendshipId);
      toast.success('Amizade removida.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function handleRemind(friendId: string) {
    try {
      await remind.mutateAsync(friendId);
      toast.success('Lembrete enviado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar lembrete.');
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: '1.05rem' }}>Seus amigos</h2>
      {edges.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Você ainda não tem amigos. Use a busca acima para adicionar pessoas.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {edges.map((e) =>
            e.other ? (
              <PersonRow
                key={e.friendship.id}
                profile={e.other}
                action={
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRemind(e.other!.id)}
                      loading={remind.isPending}
                    >
                      Lembrete de estudo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(e.friendship.id)}
                    >
                      Remover
                    </Button>
                  </div>
                }
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

export default FriendsPage;
