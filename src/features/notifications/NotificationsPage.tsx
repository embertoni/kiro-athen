/**
 * NotificationsPage (/notifications) — the internal notification inbox.
 *
 * Lists persistent notifications (newest first) with read/unread state, a
 * mark-all-read action, per-item mark-as-read, and a deep link to the relevant
 * page. Covers the 5 server enum types.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import type { NotificationRow } from '@/types/database';
import { useMarkAllRead, useMarkRead, useNotifications } from './api';
import {
  notificationLink,
  notificationTypeIcon,
  notificationTypeLabel,
  relativeTime,
  unreadCount,
} from './helpers';

export function NotificationsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();

  const query = useNotifications(userId);
  const markRead = useMarkRead(userId);
  const markAll = useMarkAllRead(userId);

  const items = query.data ?? [];
  const unread = unreadCount(items);

  function openNotification(n: NotificationRow) {
    if (!n.is_read) markRead.mutate(n.id);
    const to = notificationLink(n);
    if (to) navigate(to);
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '42rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: 'var(--brand-purple)' }}>
            Notificações
          </h1>
          <p
            style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}
          >
            {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia.'}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
          >
            Marcar todas como lidas
          </Button>
        )}
      </header>

      {query.isLoading && <Spinner size={28} />}
      {query.isError && (
        <ErrorText>
          {formatError(
            query.error,
            'Não foi possível carregar as notificações',
          )}
        </ErrorText>
      )}

      {query.data && items.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          Você ainda não tem notificações.
        </p>
      )}

      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => openNotification(n)}
            style={{
              textAlign: 'left',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: n.is_read
                ? 'var(--color-surface)'
                : 'rgba(91, 42, 134, 0.07)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '1.3rem' }} aria-hidden>
              {notificationTypeIcon(n.type)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'space-between',
                }}
              >
                <strong style={{ fontSize: '0.92rem' }}>{n.title}</strong>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relativeTime(n.created_at)}
                </span>
              </div>
              {n.message && (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {n.message}
                </div>
              )}
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--brand-purple)',
                  marginTop: '0.2rem',
                }}
              >
                {notificationTypeLabel(n.type)}
              </div>
            </div>
            {!n.is_read && (
              <span
                aria-label="não lida"
                style={{
                  width: '0.55rem',
                  height: '0.55rem',
                  borderRadius: '50%',
                  background: 'var(--brand-gold)',
                  marginTop: '0.3rem',
                  flexShrink: 0,
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default NotificationsPage;
