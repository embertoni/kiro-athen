/**
 * Pure helpers for the friends feature (unit-tested; no I/O).
 *
 * The friendship status reducer turns a stored friendship row (direction +
 * status) into a UI relation from the current user's point of view, so the UI
 * can show the right action (accept, cancel, remove, add...). The server
 * (friendships RLS) remains the authority; these helpers only shape display.
 */

import type { FriendshipRow, FriendshipStatus } from '@/types/database';

/**
 * The current user's relationship to another user, derived from the friendship
 * row (if any). Drives which action buttons the UI renders.
 *   none            — no row / terminal declined-cancelled: can send a request
 *   friends         — accepted both ways
 *   request_sent    — pending, current user is the requester (can cancel)
 *   request_received— pending, current user is the addressee (accept/decline)
 */
export type FriendRelation =
  'none' | 'friends' | 'request_sent' | 'request_received';

export interface FriendStatus {
  relation: FriendRelation;
  /** The underlying friendship row id, when one exists. */
  friendshipId: string | null;
}

/**
 * Reduce a friendship row (or absence of one) into the viewer-relative relation.
 * `viewerId` is the current user; `otherId` is the user being viewed.
 */
export function reduceFriendStatus(
  viewerId: string,
  otherId: string,
  friendship:
    | Pick<FriendshipRow, 'id' | 'requester_id' | 'addressee_id' | 'status'>
    | null
    | undefined,
): FriendStatus {
  if (!friendship) {
    return { relation: 'none', friendshipId: null };
  }

  const { id, requester_id, addressee_id, status } = friendship;

  // The row must involve both users; otherwise treat as no relation.
  const involvesBoth =
    (requester_id === viewerId && addressee_id === otherId) ||
    (requester_id === otherId && addressee_id === viewerId);
  if (!involvesBoth) {
    return { relation: 'none', friendshipId: null };
  }

  if (status === 'accepted') {
    return { relation: 'friends', friendshipId: id };
  }

  if (status === 'pending') {
    return requester_id === viewerId
      ? { relation: 'request_sent', friendshipId: id }
      : { relation: 'request_received', friendshipId: id };
  }

  // declined / cancelled are terminal: the pair may start over.
  return { relation: 'none', friendshipId: id };
}

/** Human (pt-BR) label for a raw friendship status. */
export function friendshipStatusLabel(status: FriendshipStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'accepted':
      return 'Amigos';
    case 'declined':
      return 'Recusado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

/**
 * Given a friendship row, which of the two participants is the "other" user
 * relative to the viewer. Returns null when the row does not involve the viewer.
 */
export function otherParticipantId(
  viewerId: string,
  friendship: Pick<FriendshipRow, 'requester_id' | 'addressee_id'>,
): string | null {
  if (friendship.requester_id === viewerId) return friendship.addressee_id;
  if (friendship.addressee_id === viewerId) return friendship.requester_id;
  return null;
}
