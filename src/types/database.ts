/**
 * Supabase database types for Athen.
 *
 * Hand-written to match the SQL in supabase/migrations/ exactly (tables
 * Row/Insert/Update, enums, and server-authoritative RPC function signatures).
 * The server (RLS + domain functions) is the authority; these types only make
 * the typed Supabase client and queries compile against the real schema.
 *
 * Keep in sync with the migrations. See src/types/domain.ts for app-facing
 * interfaces (per-type question config unions, etc.).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enum literal unions (mirror 0001_extensions_and_enums.sql)
// ---------------------------------------------------------------------------
export type UserRole = 'student' | 'educator' | 'admin';
export type CourseStatus = 'draft' | 'published';
export type CourseVisibility = 'public' | 'private';
export type QuestionType =
  | 'match'
  | 'multiple_choice'
  | 'fill_blank'
  | 'sum_alternatives';
export type EnrollmentStatus = 'active' | 'completed' | 'dropped';
export type RoomMemberStatus = 'active' | 'removed';
export type FriendshipStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled';
export type NotificationType =
  | 'atualizacao_curso'
  | 'pedido_amizade'
  | 'convite_sala'
  | 'missao'
  | 'lembrete_estudo';
export type AccountStatus = 'active' | 'deactivated';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type CompletionContext = 'course' | 'room';
export type PacVisibility = 'members' | 'educator_only' | 'public';

/** Helper to build a table definition with Row/Insert/Update + no relationships metadata. */
interface TableShape<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

// ---------------------------------------------------------------------------
// Row interfaces
// ---------------------------------------------------------------------------
export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  xp_global: number;
  level: number;
  streak_count: number;
  last_study_date: string | null;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface CourseRow {
  id: string;
  creator_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  cover_url: string | null;
  status: CourseStatus;
  visibility: CourseVisibility;
  created_at: string;
  updated_at: string;
}

export interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  position: number;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface QuestionRow {
  id: string;
  lesson_id: string;
  type: QuestionType;
  prompt: string;
  position: number;
  config: Json;
  xp_value: number;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface AttemptRow {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string | null;
  room_id: string | null;
  started_at: string;
  finished_at: string | null;
  xp_earned: number;
  correct_count: number;
  total_count: number;
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  submitted: Json;
  is_correct: boolean;
  xp_earned: number;
  created_at: string;
}

export interface CompletionRow {
  id: string;
  user_id: string;
  lesson_id: string;
  context: CompletionContext;
  attempt_id: string | null;
  completed_at: string;
}

export interface RoomRow {
  id: string;
  educator_id: string;
  course_id: string | null;
  name: string;
  access_code: string;
  code_active: boolean;
  pac_visibility: PacVisibility;
  created_at: string;
  updated_at: string;
}

export interface RoomMemberRow {
  id: string;
  room_id: string;
  user_id: string;
  status: RoomMemberStatus;
  joined_at: string;
  removed_at: string | null;
  xp_internal: number;
  progress: number;
  pac_internal: number;
}

export interface AnnouncementRow {
  id: string;
  room_id: string;
  author_id: string;
  title: string;
  content: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface MissionRow {
  id: string;
  room_id: string;
  author_id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  reward_xp: number;
  min_correct: number;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface MissionProgressRow {
  id: string;
  mission_id: string;
  user_id: string;
  progress: number;
  completed: boolean;
  updated_at: string;
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface MedalRow {
  code: string;
  name: string;
  description: string;
  icon: string | null;
}

export interface UserMedalRow {
  id: string;
  user_id: string;
  medal_code: string;
  acquired_at: string;
  featured: boolean;
}

export interface ReviewRow {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  comment: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: string;
  author_id: string;
  course_id: string | null;
  lesson_id: string | null;
  parent_id: string | null;
  content: string;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface NotebookRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface NotebookPageRow {
  id: string;
  notebook_id: string;
  title: string;
  content: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert / Update helper types: all generated/defaulted columns optional.
// ---------------------------------------------------------------------------
type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type ProfileInsert = Opt<
  ProfileRow,
  | 'role'
  | 'bio'
  | 'avatar_url'
  | 'banner_url'
  | 'xp_global'
  | 'level'
  | 'streak_count'
  | 'last_study_date'
  | 'account_status'
  | 'created_at'
  | 'updated_at'
>;

type CourseInsert = Opt<
  CourseRow,
  | 'id'
  | 'description'
  | 'category'
  | 'tags'
  | 'cover_url'
  | 'status'
  | 'visibility'
  | 'created_at'
  | 'updated_at'
>;

type ModuleInsert = Opt<
  ModuleRow,
  'id' | 'description' | 'position' | 'color' | 'created_at' | 'updated_at'
>;

type LessonInsert = Opt<
  LessonRow,
  'id' | 'content' | 'position' | 'status' | 'created_at' | 'updated_at'
>;

type QuestionInsert = Opt<
  QuestionRow,
  'id' | 'position' | 'config' | 'xp_value' | 'created_at' | 'updated_at'
>;

type EnrollmentInsert = Opt<
  EnrollmentRow,
  'id' | 'status' | 'progress' | 'created_at' | 'updated_at'
>;

type AttemptInsert = Opt<
  AttemptRow,
  | 'id'
  | 'course_id'
  | 'room_id'
  | 'started_at'
  | 'finished_at'
  | 'xp_earned'
  | 'correct_count'
  | 'total_count'
>;

type AnswerInsert = Opt<
  AnswerRow,
  'id' | 'submitted' | 'is_correct' | 'xp_earned' | 'created_at'
>;

type CompletionInsert = Opt<
  CompletionRow,
  'id' | 'attempt_id' | 'completed_at'
>;

type RoomInsert = Opt<
  RoomRow,
  'id' | 'course_id' | 'code_active' | 'pac_visibility' | 'created_at' | 'updated_at'
>;

type RoomMemberInsert = Opt<
  RoomMemberRow,
  | 'id'
  | 'status'
  | 'joined_at'
  | 'removed_at'
  | 'xp_internal'
  | 'progress'
  | 'pac_internal'
>;

type AnnouncementInsert = Opt<
  AnnouncementRow,
  'id' | 'content' | 'status' | 'created_at' | 'updated_at'
>;

type MissionInsert = Opt<
  MissionRow,
  | 'id'
  | 'description'
  | 'deadline'
  | 'reward_xp'
  | 'min_correct'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

type MissionProgressInsert = Opt<
  MissionProgressRow,
  'id' | 'progress' | 'completed' | 'updated_at'
>;

type FriendshipInsert = Opt<
  FriendshipRow,
  'id' | 'status' | 'created_at' | 'responded_at'
>;

type NotificationInsert = Opt<
  NotificationRow,
  'id' | 'message' | 'reference_id' | 'is_read' | 'created_at'
>;

type MedalInsert = Opt<MedalRow, 'icon'>;

type UserMedalInsert = Opt<
  UserMedalRow,
  'id' | 'acquired_at' | 'featured'
>;

type ReviewInsert = Opt<
  ReviewRow,
  'id' | 'comment' | 'status' | 'created_at' | 'updated_at'
>;

type CommentInsert = Opt<
  CommentRow,
  'id' | 'course_id' | 'lesson_id' | 'parent_id' | 'status' | 'created_at' | 'updated_at'
>;

type NotebookInsert = Opt<NotebookRow, 'id' | 'created_at' | 'updated_at'>;

type NotebookPageInsert = Opt<
  NotebookPageRow,
  'id' | 'content' | 'position' | 'created_at' | 'updated_at'
>;

// ---------------------------------------------------------------------------
// Database type consumed by createClient<Database>()
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow, ProfileInsert, Partial<ProfileRow>>;
      courses: TableShape<CourseRow, CourseInsert, Partial<CourseRow>>;
      modules: TableShape<ModuleRow, ModuleInsert, Partial<ModuleRow>>;
      lessons: TableShape<LessonRow, LessonInsert, Partial<LessonRow>>;
      questions: TableShape<QuestionRow, QuestionInsert, Partial<QuestionRow>>;
      enrollments: TableShape<EnrollmentRow, EnrollmentInsert, Partial<EnrollmentRow>>;
      attempts: TableShape<AttemptRow, AttemptInsert, Partial<AttemptRow>>;
      answers: TableShape<AnswerRow, AnswerInsert, Partial<AnswerRow>>;
      completions: TableShape<CompletionRow, CompletionInsert, Partial<CompletionRow>>;
      rooms: TableShape<RoomRow, RoomInsert, Partial<RoomRow>>;
      room_members: TableShape<RoomMemberRow, RoomMemberInsert, Partial<RoomMemberRow>>;
      announcements: TableShape<AnnouncementRow, AnnouncementInsert, Partial<AnnouncementRow>>;
      missions: TableShape<MissionRow, MissionInsert, Partial<MissionRow>>;
      mission_progress: TableShape<MissionProgressRow, MissionProgressInsert, Partial<MissionProgressRow>>;
      friendships: TableShape<FriendshipRow, FriendshipInsert, Partial<FriendshipRow>>;
      notifications: TableShape<NotificationRow, NotificationInsert, Partial<NotificationRow>>;
      medals: TableShape<MedalRow, MedalInsert, Partial<MedalRow>>;
      user_medals: TableShape<UserMedalRow, UserMedalInsert, Partial<UserMedalRow>>;
      reviews: TableShape<ReviewRow, ReviewInsert, Partial<ReviewRow>>;
      comments: TableShape<CommentRow, CommentInsert, Partial<CommentRow>>;
      notebooks: TableShape<NotebookRow, NotebookInsert, Partial<NotebookRow>>;
      notebook_pages: TableShape<NotebookPageRow, NotebookPageInsert, Partial<NotebookPageRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      finalize_attempt: {
        Args: { p_attempt_id: string };
        Returns: {
          correct_count: number;
          total_count: number;
          xp_earned: number;
        }[];
      };
      join_room: {
        Args: { p_access_code: string };
        Returns: string;
      };
      grant_medals: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      touch_streak: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      recompute_course_progress: {
        Args: { p_user_id: string; p_course_id: string };
        Returns: number;
      };
      recompute_room_metrics: {
        Args: { p_room_id: string; p_user_id: string };
        Returns: undefined;
      };
      level_for_xp: {
        Args: { p_xp: number };
        Returns: number;
      };
      division_for_pac: {
        Args: { p_pac: number };
        Returns: string;
      };
      pac: {
        Args: { p_correct: number; p_total: number };
        Returns: number;
      };
      xp_from_question: {
        Args: { p_type: QuestionType };
        Returns: number;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      username_to_email: {
        Args: { p_username: string };
        Returns: string | null;
      };
    };
    Enums: {
      user_role: UserRole;
      course_status: CourseStatus;
      course_visibility: CourseVisibility;
      question_type: QuestionType;
      enrollment_status: EnrollmentStatus;
      room_member_status: RoomMemberStatus;
      friendship_status: FriendshipStatus;
      notification_type: NotificationType;
      account_status: AccountStatus;
      content_status: ContentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
