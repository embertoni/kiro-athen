/**
 * Pure helpers for the notifications feature (unit-tested; no I/O).
 *
 * The notification_type enum is server-authoritative (mirrored in
 * src/domain/constants.ts and src/types/database.ts). These helpers map a type
 * to a display label/icon and to the in-app route a notification should link
 * to, plus a count helper for the header bell.
 */

import type { NotificationRow, NotificationType } from '@/types/db';
import { NOTIFICATION_TYPE_LABELS } from '@/domain/constants';

/** Emoji icon per notification type (purely decorative). */
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  atualizacao_curso: '📘',
  pedido_amizade: '👋',
  convite_sala: '🚪',
  missao: '🎯',
  lembrete_estudo: '⏰',
};

/** Display label for a notification type. */
export function notificationTypeLabel(type: NotificationType): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

/** Icon for a notification type. */
export function notificationTypeIcon(type: NotificationType): string {
  return NOTIFICATION_TYPE_ICONS[type] ?? '🔔';
}

/**
 * The in-app destination for a notification, derived from its type and
 * reference_id. Returns null when there is no sensible deep link.
 */
export function notificationLink(
  notification: Pick<NotificationRow, 'type' | 'reference_id'>,
): string | null {
  switch (notification.type) {
    case 'pedido_amizade':
    case 'lembrete_estudo':
      return '/friends';
    case 'convite_sala':
    case 'missao':
      return notification.reference_id
        ? `/rooms/${notification.reference_id}`
        : '/rooms';
    case 'atualizacao_curso':
      return '/catalog';
    default:
      return null;
  }
}

/** Count unread notifications. Used by the header bell badge. */
export function unreadCount(
  notifications: Pick<NotificationRow, 'is_read'>[],
): number {
  return notifications.reduce((n, item) => (item.is_read ? n : n + 1), 0);
}

/**
 * Format the badge text for the header bell. Caps large counts at "9+" so the
 * badge stays compact.
 */
export function formatUnreadBadge(count: number): string {
  if (count <= 0) return '';
  if (count > 9) return '9+';
  return String(count);
}

/**
 * Relative pt-BR time label for a notification timestamp (coarse buckets:
 * agora, Xmin, Xh, Xd, else a locale date). Pure given a `now` reference.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
