/**
 * App-facing domain interfaces for Athen.
 *
 * These are the richly-typed shapes the UI works with, layered on top of the
 * raw Supabase rows exposed through src/types/db.ts. In particular they model the
 * per-question-type `config` and `submitted` jsonb unions that the server
 * grader (grade_answer in 0010_domain_functions.sql) reads.
 */

import type {
  AccountStatus,
  AnnouncementRow,
  AttemptRow,
  CommentRow,
  CompletionContext,
  ContentStatus,
  CourseStatus,
  CourseVisibility,
  EnrollmentRow,
  EnrollmentStatus,
  FriendshipRow,
  FriendshipStatus,
  MedalRow,
  MissionRow,
  NotebookPageRow,
  NotebookRow,
  NotificationRow,
  NotificationType,
  QuestionType,
  ReviewRow,
  RoomMemberRow,
  RoomMemberStatus,
  UserMedalRow,
  UserRole,
} from './db';

// ---------------------------------------------------------------------------
// Question config + submitted answer unions (match the SQL grader exactly)
// ---------------------------------------------------------------------------

/** match: associate left/right pairs. */
export interface MatchPair {
  left: string;
  right: string;
}
export interface MatchConfig {
  pairs: MatchPair[];
}
export interface MatchSubmitted {
  pairs: MatchPair[];
}

/** multiple_choice: exact set of correct option ids; no partial credit. */
export interface MultipleChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}
export interface MultipleChoiceConfig {
  options: MultipleChoiceOption[];
}
export interface MultipleChoiceSubmitted {
  selected: string[];
}

/** fill_blank: any configured answer, compared after normalization. */
export interface FillBlankConfig {
  answers: string[];
}
export interface FillBlankSubmitted {
  text: string;
}

/** sum_alternatives: numeric sum of correct statements equals expected. */
export interface SumStatement {
  value: number;
  correct: boolean;
}
export interface SumAlternativesConfig {
  statements: SumStatement[];
  /** When omitted, the server uses the sum of the correct statements. */
  expected?: number;
}
export interface SumAlternativesSubmitted {
  sum: number;
}

export type QuestionConfig =
  MatchConfig | MultipleChoiceConfig | FillBlankConfig | SumAlternativesConfig;

export type SubmittedAnswer =
  | MatchSubmitted
  | MultipleChoiceSubmitted
  | FillBlankSubmitted
  | SumAlternativesSubmitted;

/** Map each question type to its config shape. */
export interface QuestionConfigByType {
  match: MatchConfig;
  multiple_choice: MultipleChoiceConfig;
  fill_blank: FillBlankConfig;
  sum_alternatives: SumAlternativesConfig;
}

/** Map each question type to its submitted-answer shape. */
export interface SubmittedByType {
  match: MatchSubmitted;
  multiple_choice: MultipleChoiceSubmitted;
  fill_blank: FillBlankSubmitted;
  sum_alternatives: SumAlternativesSubmitted;
}

/** A question with a type-narrowed config. */
export type TypedQuestion = {
  [K in QuestionType]: {
    id: string;
    lessonId: string;
    type: K;
    prompt: string;
    position: number;
    config: QuestionConfigByType[K];
    xpValue: number;
  };
}[QuestionType];

// ---------------------------------------------------------------------------
// Aggregate / view models used across the UI
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  xpGlobal: number;
  level: number;
  streakCount: number;
  lastStudyDate: string | null;
  accountStatus: AccountStatus;
}

export interface Course {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  coverUrl: string | null;
  status: CourseStatus;
  visibility: CourseVisibility;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  color: string | null;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  position: number;
  status: ContentStatus;
}

/** A course with its nested modules, lessons and typed questions. */
export interface CourseTree extends Course {
  modules: (Module & {
    lessons: (Lesson & { questions: TypedQuestion[] })[];
  })[];
}

export interface Attempt {
  id: string;
  userId: string;
  lessonId: string;
  courseId: string | null;
  roomId: string | null;
  startedAt: string;
  finishedAt: string | null;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

/** Result returned by the finalize_attempt RPC. */
export interface AttemptResult {
  correctCount: number;
  totalCount: number;
  xpEarned: number;
}

export interface Room {
  id: string;
  educatorId: string;
  courseId: string | null;
  name: string;
  accessCode: string;
  codeActive: boolean;
  pacVisibility: 'members' | 'educator_only' | 'public';
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  status: RoomMemberStatus;
  xpInternal: number;
  progress: number;
  pacInternal: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progress: number;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Medal {
  code: string;
  name: string;
  description: string;
  icon: string | null;
}

export interface UserMedal {
  id: string;
  userId: string;
  medalCode: string;
  acquiredAt: string;
  featured: boolean;
}

export interface CompletionSummary {
  lessonId: string;
  context: CompletionContext;
  completedAt: string;
}

// Re-export raw row aliases for convenience where the mapped camelCase view
// models are not needed.
export type {
  AnnouncementRow,
  AttemptRow,
  CommentRow,
  EnrollmentRow,
  FriendshipRow,
  MedalRow,
  MissionRow,
  NotebookPageRow,
  NotebookRow,
  NotificationRow,
  ReviewRow,
  RoomMemberRow,
  UserMedalRow,
};
