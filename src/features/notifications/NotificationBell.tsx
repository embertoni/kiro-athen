/**
 * NotificationBell — the header indicator showing the unread notification count.
 *
 * Polls the unread count and links to /notifications. Rendered in the AppShell
 * header for authenticated users.
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUnreadCount } from './api';
import { formatUnreadBadge } from './helpers';

export function NotificationBell() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: count = 0 } = useUnreadCount(userId);
  const badge = formatUnreadBadge(count);

  return (
    <NavLink
      to="/notifications"
      aria-label={
        count > 0 ? `Notificações, ${count} não lidas` : 'Notificações'
      }
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2.1rem',
        height: '2.1rem',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        fontSize: '1.2rem',
      }}
    >
      <span aria-hidden>🔔</span>
      {badge && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '-0.1rem',
            right: '-0.1rem',
            minWidth: '1.05rem',
            height: '1.05rem',
            padding: '0 0.2rem',
            borderRadius: '0.6rem',
            background: 'var(--brand-gold)',
            color: '#3a2a00',
            fontSize: '0.68rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default NotificationBell;
