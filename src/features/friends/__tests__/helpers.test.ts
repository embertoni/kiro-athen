import { describe, expect, it } from 'vitest';
import type { FriendshipRow } from '@/types/db';
import {
  friendshipStatusLabel,
  otherParticipantId,
  reduceFriendStatus,
} from '../helpers';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function row(
  partial: Partial<
    Pick<FriendshipRow, 'id' | 'requester_id' | 'addressee_id' | 'status'>
  >,
) {
  return {
    id: 'f1',
    requester_id: A,
    addressee_id: B,
    status: 'pending' as const,
    ...partial,
  };
}

describe('reduceFriendStatus', () => {
  it('returns none when there is no friendship row', () => {
    expect(reduceFriendStatus(A, B, null)).toEqual({
      relation: 'none',
      friendshipId: null,
    });
    expect(reduceFriendStatus(A, B, undefined)).toEqual({
      relation: 'none',
      friendshipId: null,
    });
  });

  it('maps accepted to friends from either viewpoint', () => {
    const accepted = row({ status: 'accepted' });
    expect(reduceFriendStatus(A, B, accepted)).toEqual({
      relation: 'friends',
      friendshipId: 'f1',
    });
    expect(reduceFriendStatus(B, A, accepted)).toEqual({
      relation: 'friends',
      friendshipId: 'f1',
    });
  });

  it('distinguishes sent vs received for a pending request', () => {
    const pending = row({ status: 'pending' });
    // A is the requester => A sees "request_sent".
    expect(reduceFriendStatus(A, B, pending).relation).toBe('request_sent');
    // B is the addressee => B sees "request_received".
    expect(reduceFriendStatus(B, A, pending).relation).toBe('request_received');
  });

  it('treats declined / cancelled as a fresh none (reusable pair)', () => {
    expect(reduceFriendStatus(A, B, row({ status: 'declined' })).relation).toBe(
      'none',
    );
    expect(
      reduceFriendStatus(A, B, row({ status: 'cancelled' })).relation,
    ).toBe('none');
  });

  it('ignores a row that does not involve both users', () => {
    const unrelated = row({ requester_id: A, addressee_id: C });
    expect(reduceFriendStatus(A, B, unrelated)).toEqual({
      relation: 'none',
      friendshipId: null,
    });
  });
});

describe('friendshipStatusLabel', () => {
  it('labels each status in pt-BR', () => {
    expect(friendshipStatusLabel('pending')).toBe('Pendente');
    expect(friendshipStatusLabel('accepted')).toBe('Amigos');
    expect(friendshipStatusLabel('declined')).toBe('Recusado');
    expect(friendshipStatusLabel('cancelled')).toBe('Cancelado');
  });
});

describe('otherParticipantId', () => {
  it('returns the counterpart relative to the viewer', () => {
    expect(otherParticipantId(A, { requester_id: A, addressee_id: B })).toBe(B);
    expect(otherParticipantId(B, { requester_id: A, addressee_id: B })).toBe(A);
  });

  it('returns null when the viewer is not a participant', () => {
    expect(
      otherParticipantId(C, { requester_id: A, addressee_id: B }),
    ).toBeNull();
  });
});
