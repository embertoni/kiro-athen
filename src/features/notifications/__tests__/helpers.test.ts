import { describe, expect, it } from 'vitest';
import {
  formatUnreadBadge,
  notificationLink,
  notificationTypeIcon,
  notificationTypeLabel,
  relativeTime,
  unreadCount,
} from '../helpers';

describe('notificationTypeLabel', () => {
  it('labels each DB enum type in pt-BR', () => {
    expect(notificationTypeLabel('atualizacao_curso')).toBe('Atualização de curso');
    expect(notificationTypeLabel('pedido_amizade')).toBe('Pedido de amizade');
    expect(notificationTypeLabel('convite_sala')).toBe('Convite para sala');
    expect(notificationTypeLabel('missao')).toBe('Missão');
    expect(notificationTypeLabel('lembrete_estudo')).toBe('Lembrete de estudo');
  });
});

describe('notificationTypeIcon', () => {
  it('returns an icon for each type', () => {
    expect(notificationTypeIcon('pedido_amizade')).toBe('👋');
    expect(notificationTypeIcon('missao')).toBe('🎯');
  });
});

describe('notificationLink', () => {
  it('routes friend-related notifications to /friends', () => {
    expect(notificationLink({ type: 'pedido_amizade', reference_id: null })).toBe('/friends');
    expect(notificationLink({ type: 'lembrete_estudo', reference_id: null })).toBe('/friends');
  });

  it('routes room notifications to the referenced room', () => {
    expect(notificationLink({ type: 'convite_sala', reference_id: 'room-1' })).toBe('/rooms/room-1');
    expect(notificationLink({ type: 'missao', reference_id: 'room-2' })).toBe('/rooms/room-2');
  });

  it('falls back to /rooms when a room notification has no reference', () => {
    expect(notificationLink({ type: 'convite_sala', reference_id: null })).toBe('/rooms');
  });

  it('routes course updates to the catalog', () => {
    expect(notificationLink({ type: 'atualizacao_curso', reference_id: 'c1' })).toBe('/catalog');
  });
});

describe('unreadCount + formatUnreadBadge', () => {
  it('counts only unread notifications', () => {
    expect(
      unreadCount([
        { is_read: false },
        { is_read: true },
        { is_read: false },
      ]),
    ).toBe(2);
    expect(unreadCount([])).toBe(0);
  });

  it('formats the badge text, capping at 9+', () => {
    expect(formatUnreadBadge(0)).toBe('');
    expect(formatUnreadBadge(-3)).toBe('');
    expect(formatUnreadBadge(3)).toBe('3');
    expect(formatUnreadBadge(9)).toBe('9');
    expect(formatUnreadBadge(10)).toBe('9+');
    expect(formatUnreadBadge(250)).toBe('9+');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-01-10T12:00:00Z');

  it('buckets recent timestamps', () => {
    expect(relativeTime('2026-01-10T11:59:30Z', now)).toBe('agora');
    expect(relativeTime('2026-01-10T11:45:00Z', now)).toBe('15 min');
    expect(relativeTime('2026-01-10T09:00:00Z', now)).toBe('3 h');
    expect(relativeTime('2026-01-08T12:00:00Z', now)).toBe('2 d');
  });

  it('falls back to a locale date for old timestamps', () => {
    const label = relativeTime('2025-12-01T12:00:00Z', now);
    expect(label).not.toBe('agora');
    expect(label).toMatch(/\d/);
  });
});
