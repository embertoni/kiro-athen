/**
 * Regen-safe barrel for Supabase database types.
 *
 * src/types/database.ts is produced verbatim by `supabase gen types` and must
 * NEVER be hand-edited or have exports appended. It only exposes the raw
 * generator output (Json, Database, Constants and the generator helper types).
 *
 * All app-facing convenience aliases live HERE so that regenerating
 * database.ts never breaks the build. Import database types from '@/types/db'.
 */
export * from './database';

import type { Database } from './database';

// Enum aliases derived from the generated pg enums.
export type AccountStatus = Database['public']['Enums']['account_status'];
export type ContentStatus = Database['public']['Enums']['content_status'];
export type CourseStatus = Database['public']['Enums']['course_status'];
export type CourseVisibility = Database['public']['Enums']['course_visibility'];
export type EnrollmentStatus = Database['public']['Enums']['enrollment_status'];
export type FriendshipStatus = Database['public']['Enums']['friendship_status'];
export type NotificationType = Database['public']['Enums']['notification_type'];
export type QuestionType = Database['public']['Enums']['question_type'];
export type RoomMemberStatus =
  Database['public']['Enums']['room_member_status'];
export type UserRole = Database['public']['Enums']['user_role'];

// Non-enum string-literal unions. These columns are plain `text` in Postgres,
// so the generator widens them to `string`; keep them as explicit unions that
// match the app domain model.
export type CompletionContext = 'course' | 'room';
export type PacVisibility = 'members' | 'educator_only' | 'public';

// Row aliases derived from the generated table shapes.
export type AnnouncementRow =
  Database['public']['Tables']['announcements']['Row'];
export type AnswerRow = Database['public']['Tables']['answers']['Row'];
export type AttemptRow = Database['public']['Tables']['attempts']['Row'];
export type CommentRow = Database['public']['Tables']['comments']['Row'];
export type CompletionRow = Database['public']['Tables']['completions']['Row'];
export type CourseRow = Database['public']['Tables']['courses']['Row'];
export type EnrollmentRow = Database['public']['Tables']['enrollments']['Row'];
export type FriendshipRow = Database['public']['Tables']['friendships']['Row'];
export type LessonRow = Database['public']['Tables']['lessons']['Row'];
export type MedalRow = Database['public']['Tables']['medals']['Row'];
export type MissionRow = Database['public']['Tables']['missions']['Row'];
export type ModuleRow = Database['public']['Tables']['modules']['Row'];
export type NotebookPageRow =
  Database['public']['Tables']['notebook_pages']['Row'];
export type NotebookRow = Database['public']['Tables']['notebooks']['Row'];
export type NotificationRow =
  Database['public']['Tables']['notifications']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type QuestionRow = Database['public']['Tables']['questions']['Row'];
export type ReviewRow = Database['public']['Tables']['reviews']['Row'];
export type RoomMemberRow = Database['public']['Tables']['room_members']['Row'];
export type RoomRow = Database['public']['Tables']['rooms']['Row'];
export type UserMedalRow = Database['public']['Tables']['user_medals']['Row'];
