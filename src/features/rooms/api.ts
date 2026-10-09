/**
 * Data-access layer for the rooms (salas) feature.
 *
 * TanStack Query hooks over the typed Supabase client. The server is the
 * authority: RLS scopes room/member/announcement/mission reads+writes, and the
 * join_room / finalize_attempt / recompute_room_metrics RPCs own membership and
 * all XP/PAC/progress. Nothing here computes trusted XP. Room-context study is
 * done by navigating to /lesson/:id?room=<roomId> (LessonView threads the room
 * context into finalize_attempt), which keeps room XP internal and never global.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  AnnouncementRow,
  CourseRow,
  MissionRow,
  PacVisibility,
  ProfileRow,
  RoomMemberRow,
  RoomRow,
} from '@/types/database';
import { generateAccessCode } from './helpers';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const roomKeys = {
  all: ['rooms'] as const,
  mine: (userId: string | undefined) => ['rooms', 'mine', userId] as const,
  detail: (roomId: string) => ['rooms', 'detail', roomId] as const,
  members: (roomId: string) => ['rooms', 'members', roomId] as const,
  announcements: (roomId: string) =>
    ['rooms', 'announcements', roomId] as const,
  missions: (roomId: string) => ['rooms', 'missions', roomId] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomSummary {
  room: RoomRow;
  courseTitle: string | null;
  /** How the current user relates to the room. */
  relation: 'educator' | 'member';
  memberCount: number;
}

export interface MyRooms {
  asEducator: RoomSummary[];
  asMember: RoomSummary[];
}

export interface RoomMemberView {
  member: RoomMemberRow;
  profile: Pick<
    ProfileRow,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null;
}

export interface RoomDetail {
  room: RoomRow;
  course: Pick<CourseRow, 'id' | 'title' | 'slug'> | null;
  /** True when the current user owns (educates) the room. */
  isEducator: boolean;
  /** The current user's own active membership row, if a member. */
  myMembership: RoomMemberRow | null;
}

// ---------------------------------------------------------------------------
// Listing: my rooms (as educator and as member)
// ---------------------------------------------------------------------------

export function useMyRooms(userId: string | undefined) {
  return useQuery<MyRooms>({
    enabled: !!userId,
    queryKey: roomKeys.mine(userId),
    queryFn: async () => {
      const uid = userId as string;

      const [ownedRes, memberRes] = await Promise.all([
        supabase
          .from('rooms')
          .select(
            'id, educator_id, course_id, name, access_code, code_active, pac_visibility, created_at, updated_at, course:courses(title), members:room_members(count)',
          )
          .eq('educator_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('room_members')
          .select(
            'id, room_id, user_id, status, joined_at, removed_at, xp_internal, progress, pac_internal, room:rooms(id, educator_id, course_id, name, access_code, code_active, pac_visibility, created_at, updated_at, course:courses(title), members:room_members(count))',
          )
          .eq('user_id', uid)
          .eq('status', 'active')
          .order('joined_at', { ascending: false }),
      ]);

      if (ownedRes.error) throw ownedRes.error;
      if (memberRes.error) throw memberRes.error;

      type OwnedRow = RoomRow & {
        course: { title: string } | null;
        members: { count: number }[];
      };
      const asEducator: RoomSummary[] = (
        (ownedRes.data ?? []) as unknown as OwnedRow[]
      ).map((r) => ({
        room: r,
        courseTitle: r.course?.title ?? null,
        relation: 'educator',
        memberCount: r.members?.[0]?.count ?? 0,
      }));

      type MemberRow = RoomMemberRow & {
        room:
          | (RoomRow & {
              course: { title: string } | null;
              members: { count: number }[];
            })
          | null;
      };
      const asMember: RoomSummary[] = (
        (memberRes.data ?? []) as unknown as MemberRow[]
      )
        .filter((r) => r.room && r.room.educator_id !== uid)
        .map((r) => ({
          room: r.room as RoomRow,
          courseTitle: r.room?.course?.title ?? null,
          relation: 'member',
          memberCount: r.room?.members?.[0]?.count ?? 0,
        }));

      return { asEducator, asMember };
    },
  });
}

// ---------------------------------------------------------------------------
// Room detail + members
// ---------------------------------------------------------------------------

export function useRoomDetail(
  roomId: string | undefined,
  userId: string | undefined,
) {
  return useQuery<RoomDetail>({
    enabled: !!roomId,
    queryKey: roomKeys.detail(roomId ?? ''),
    queryFn: async () => {
      const id = roomId as string;
      const { data, error } = await supabase
        .from('rooms')
        .select(
          'id, educator_id, course_id, name, access_code, code_active, pac_visibility, created_at, updated_at, course:courses(id, title, slug)',
        )
        .eq('id', id)
        .single();
      if (error) throw error;

      const room = data as unknown as RoomRow & {
        course: Pick<CourseRow, 'id' | 'title' | 'slug'> | null;
      };

      let myMembership: RoomMemberRow | null = null;
      if (userId && room.educator_id !== userId) {
        const { data: mem, error: memErr } = await supabase
          .from('room_members')
          .select('*')
          .eq('room_id', id)
          .eq('user_id', userId)
          .maybeSingle();
        if (memErr) throw memErr;
        myMembership = mem;
      }

      return {
        room,
        course: room.course,
        isEducator: !!userId && room.educator_id === userId,
        myMembership,
      };
    },
  });
}

/**
 * List members. `onlyActive` filters to the active ranking roster. `enabled`
 * lets callers gate the query (e.g. skip fetching when the ranking is hidden);
 * it still requires a `roomId` to run.
 */
export function useRoomMembers(
  roomId: string | undefined,
  onlyActive = false,
  enabled = true,
) {
  return useQuery<RoomMemberView[]>({
    enabled: !!roomId && enabled,
    queryKey: [...roomKeys.members(roomId ?? ''), onlyActive],
    queryFn: async () => {
      let query = supabase
        .from('room_members')
        .select(
          'id, room_id, user_id, status, joined_at, removed_at, xp_internal, progress, pac_internal, profile:profiles(id, username, display_name, avatar_url)',
        )
        .eq('room_id', roomId as string);
      if (onlyActive) query = query.eq('status', 'active');

      const { data, error } = await query.order('xp_internal', {
        ascending: false,
      });
      if (error) throw error;

      type Row = RoomMemberRow & {
        profile: RoomMemberView['profile'];
      };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        member: r,
        profile: r.profile,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Create room / manage access code
// ---------------------------------------------------------------------------

export interface CreateRoomInput {
  educatorId: string;
  courseId: string;
  name: string;
  pacVisibility?: PacVisibility;
}

/**
 * Create a room. Enforced server-side by RLS (educator_id = auth.uid()); we also
 * verify client-side that the course belongs to the educator for a friendly
 * error. Generates a unique access code (retries on the unique collision).
 */
export async function createRoom(input: CreateRoomInput): Promise<RoomRow> {
  // Verify course ownership (RLS lets a creator read their own course).
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, creator_id')
    .eq('id', input.courseId)
    .single();
  if (courseErr) throw courseErr;
  if (course.creator_id !== input.educatorId) {
    throw new Error('Você só pode criar salas para cursos que você criou.');
  }

  // Try a few times in case the random code collides with the unique index.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateAccessCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        educator_id: input.educatorId,
        course_id: input.courseId,
        name: input.name,
        access_code: code,
        code_active: true,
        pac_visibility: input.pacVisibility ?? 'members',
      })
      .select('*')
      .single();
    if (!error) return data;
    // 23505 = unique_violation on access_code: retry with a new code.
    if ((error as { code?: string }).code !== '23505') throw error;
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

export function useCreateRoom(educatorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateRoomInput, 'educatorId'>) => {
      if (!educatorId)
        throw new Error('Sessão expirada. Faça login novamente.');
      return createRoom({ ...input, educatorId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

/** Regenerate the access code (educator only, enforced by RLS). */
export function useRegenerateCode(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RoomRow> => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateAccessCode();
        const { data, error } = await supabase
          .from('rooms')
          .update({ access_code: code, code_active: true })
          .eq('id', roomId)
          .select('*')
          .single();
        if (!error) return data;
        if ((error as { code?: string }).code !== '23505') throw error;
      }
      throw new Error(
        'Não foi possível gerar um código único. Tente novamente.',
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      qc.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

/** Activate or deactivate the current access code without changing it. */
export function useSetCodeActive(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (active: boolean): Promise<RoomRow> => {
      const { data, error } = await supabase
        .from('rooms')
        .update({ code_active: active })
        .eq('id', roomId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      qc.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

/** Set the room-level PAC visibility (members | educator_only | public). */
export function useSetPacVisibility(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visibility: PacVisibility): Promise<RoomRow> => {
      const { data, error } = await supabase
        .from('rooms')
        .update({ pac_visibility: visibility })
        .eq('id', roomId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Join by code (self-join via join_room RPC)
// ---------------------------------------------------------------------------

export function useJoinByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accessCode: string): Promise<string> => {
      const { data, error } = await supabase.rpc('join_room', {
        p_access_code: accessCode,
      });
      if (error) {
        // Surface a friendly message for the common invalid/inactive case.
        if (/invalid or inactive/i.test(error.message)) {
          throw new Error('Código inválido ou inativo.');
        }
        throw error;
      }
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Member management (educator)
// ---------------------------------------------------------------------------

/** Add a member by username (educator action). Looks up the profile then inserts. */
export function useAddMember(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string): Promise<RoomMemberRow> => {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) throw new Error('Usuário não encontrado.');

      // Upsert so re-adding a previously removed member reactivates them.
      const { data, error } = await supabase
        .from('room_members')
        .upsert(
          {
            room_id: roomId,
            user_id: profile.id,
            status: 'active',
            removed_at: null,
          },
          { onConflict: 'room_id,user_id' },
        )
        .select('*')
        .single();
      if (error) throw error;

      // Best-effort convite_sala notification for the invited member.
      await supabase
        .rpc('notify_room_invite', { p_room_id: roomId, p_user_id: profile.id })
        .then(({ error: nErr }) => {
          if (nErr) console.error('notify_room_invite failed', nErr);
        });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.members(roomId) });
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
    },
  });
}

/**
 * Remove a member: set status 'removed' + removed_at. History is retained (the
 * row and its attempts are kept); the member drops out of the active ranking.
 * No XP is transferred to global — room XP was always internal.
 */
export function useRemoveMember(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string): Promise<RoomMemberRow> => {
      const { data, error } = await supabase
        .from('room_members')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', memberId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.members(roomId) });
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Announcements (classroom board with history)
// ---------------------------------------------------------------------------

export interface AnnouncementView {
  announcement: AnnouncementRow;
  authorName: string;
}

export function useAnnouncements(roomId: string | undefined) {
  return useQuery<AnnouncementView[]>({
    enabled: !!roomId,
    queryKey: roomKeys.announcements(roomId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select(
          'id, room_id, author_id, title, content, status, created_at, updated_at, author:profiles(username, display_name)',
        )
        .eq('room_id', roomId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;

      type Row = AnnouncementRow & {
        author: Pick<ProfileRow, 'username' | 'display_name'> | null;
      };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        announcement: r,
        authorName: r.author?.display_name ?? r.author?.username ?? 'Educador',
      }));
    },
  });
}

export function useCreateAnnouncement(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      authorId: string;
      title: string;
      content: string;
    }): Promise<AnnouncementRow> => {
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          room_id: roomId,
          author_id: input.authorId,
          title: input.title,
          content: input.content || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.announcements(roomId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Missions (internal XP only)
// ---------------------------------------------------------------------------

export interface MissionView {
  mission: MissionRow;
  /** Participant progress rows (educator sees all; member sees own via RLS). */
  participants: {
    userId: string;
    name: string;
    progress: number;
    completed: boolean;
  }[];
}

export function useMissions(roomId: string | undefined) {
  return useQuery<MissionView[]>({
    enabled: !!roomId,
    queryKey: roomKeys.missions(roomId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select(
          'id, room_id, author_id, title, description, deadline, reward_xp, min_correct, status, created_at, updated_at, progress:mission_progress(user_id, progress, completed, user:profiles(username, display_name))',
        )
        .eq('room_id', roomId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;

      type ProgRow = {
        user_id: string;
        progress: number;
        completed: boolean;
        user: Pick<ProfileRow, 'username' | 'display_name'> | null;
      };
      type Row = MissionRow & { progress: ProgRow[] };

      return ((data ?? []) as unknown as Row[]).map((r) => ({
        mission: r,
        participants: (r.progress ?? []).map((p) => ({
          userId: p.user_id,
          name: p.user?.display_name ?? p.user?.username ?? 'Participante',
          progress: p.progress,
          completed: p.completed,
        })),
      }));
    },
  });
}

export function useCreateMission(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      authorId: string;
      title: string;
      description: string;
      deadline: string | null;
      rewardXp: number;
      minCorrect: number;
    }): Promise<MissionRow> => {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          room_id: roomId,
          author_id: input.authorId,
          title: input.title,
          description: input.description || null,
          deadline: input.deadline,
          reward_xp: input.rewardXp,
          min_correct: input.minCorrect,
        })
        .select('*')
        .single();
      if (error) throw error;

      // Best-effort missao notification for every active room member.
      await supabase
        .rpc('notify_room_mission', { p_mission_id: data.id })
        .then(({ error: nErr }) => {
          if (nErr) console.error('notify_room_mission failed', nErr);
        });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.missions(roomId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Room content (the linked course's modules/lessons) for the Conteudo tab
// ---------------------------------------------------------------------------

export interface RoomLesson {
  id: string;
  title: string;
  position: number;
}
export interface RoomModule {
  id: string;
  title: string;
  color: string | null;
  lessons: RoomLesson[];
}

/** The room's course content tree, used to launch lessons in room context. */
export function useRoomContent(courseId: string | null | undefined) {
  return useQuery<RoomModule[]>({
    enabled: !!courseId,
    queryKey: ['rooms', 'content', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title, color, position, lessons(id, title, position)')
        .eq('course_id', courseId as string)
        .order('position', { ascending: true });
      if (error) throw error;

      type Row = {
        id: string;
        title: string;
        color: string | null;
        position: number;
        lessons: { id: string; title: string; position: number }[];
      };
      return ((data ?? []) as unknown as Row[]).map((m) => ({
        id: m.id,
        title: m.title,
        color: m.color,
        lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Courses owned by the educator (for the create-room course selector)
// ---------------------------------------------------------------------------

export function useMyCoursesForRoom(userId: string | undefined) {
  return useQuery<Pick<CourseRow, 'id' | 'title'>[]>({
    enabled: !!userId,
    queryKey: ['rooms', 'my-courses', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .eq('creator_id', userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<CourseRow, 'id' | 'title'>[];
    },
  });
}
