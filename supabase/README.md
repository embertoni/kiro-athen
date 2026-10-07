# Athen database (Supabase)

The database is **fully reproducible from the ordered SQL files in
`supabase/migrations/`**. Applied in filename order they create the entire
model (section 14), enable Row Level Security on every table, install the
server-authoritative domain functions, and seed the medal catalog.

The SQL layer is the **single source of truth** for XP, grading, PAC, level,
division, medals, streak, permissions and room access. The frontend
`src/domain/` module only mirrors these numbers for display and
pre-validation; the client never sends a trusted final XP.

> There is intentionally **no weekly period, reset, cron, or scheduled job**
> anywhere in the schema (section 8.6).

## Apply the migrations

### Option A — Supabase CLI (recommended)

```bash
supabase db reset          # fresh local DB, applies every migration in order
# or against a linked project:
supabase db push
```

### Option B — SQL editor

Open each file in **filename order** (`0001_` → `0015_`) and run it. Order
matters: later migrations reference objects created earlier (FKs, enums,
functions).

## Migration map

| File | Contents |
| --- | --- |
| `0001_extensions_and_enums.sql` | `pgcrypto`, `citext`, `unaccent`; all enums |
| `0002_profiles.sql` | `profiles` + `handle_new_user()` |
| `0003_courses_modules_lessons_questions.sql` | course content hierarchy |
| `0004_enrollments_attempts_answers_completions.sql` | learning activity + audit |
| `0005_rooms_members_announcements_missions.sql` | rooms (salas) |
| `0006_social_friendships_notifications.sql` | social graph |
| `0007_medals_user_medals.sql` | medal catalog + awards |
| `0008_reviews_comments.sql` | ratings + comments |
| `0009_notebook.sql` | personal notebook |
| `0010_domain_functions.sql` | **server-authoritative domain functions** |
| `0011_rls_policies.sql` | RLS enabled + policies on every table |
| `0012_triggers.sql` | new-user, updated_at, role immutability, featured-medal guard |
| `0013_seed.sql` | medal catalog (required) + optional demo content |
| `0014_username_to_email.sql` | `username_to_email()` for login-by-username |
| `0015_rankings.sql` | `global_ranking` view + `friends_course_pac()` RPC for the gamification rankings (no weekly period) |

## Server-authoritative functions (`0010`)

| Function | Purpose |
| --- | --- |
| `xp_from_question(type)` | base XP: match 2, multiple_choice 4, fill_blank 6, sum_alternatives 8 |
| `level_for_xp(xp)` | L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999, L6+ every +2000 |
| `pac(correct, total)` | `correct/total*100`, 0 when total is 0 |
| `division_for_pac(pac)` | Bronze 0-59, Prata 60-74, Gold 75-84, Platina 85-94, Diamante 95-100 |
| `normalize_fill_blank(text)` | lower + `unaccent` + trim + collapse whitespace |
| `grade_answer(type, config, submitted, xp_value)` | per-type grading (see below) |
| `finalize_attempt(attempt_id)` | **grading entrypoint** (SECURITY DEFINER) |
| `touch_streak(user_id)` | America/Sao_Paulo, one-day tolerance, no recovery |
| `grant_medals(user_id)` | idempotent medal rules |
| `join_room(access_code)` | self-join a room with a valid, active code |
| `is_admin()` | true when the caller's profile role is `admin` (used by `/crud` RLS) |
| `username_to_email(username)` | resolves a username to its auth email for login-by-username (SECURITY DEFINER; `0014`) |
| `friends_course_pac(course_id)` | per-course PAC/division for the caller + their accepted friends, course-context attempts only (SECURITY DEFINER, friends-scoped; `0015`) |

## Rankings (`0015`)

Read-only aggregations over the already-authoritative tables; they compute no
XP and introduce **no weekly period / reset / scheduled job**:

- **`global_ranking`** (view): all-time leaderboard ordered by `xp_global`
  (ties broken by `created_at`), restricted to `active` profiles. A plain view
  inherits the caller's RLS, and `profiles` is readable by any authenticated
  user, so no `SECURITY DEFINER` is needed.
- **`friends_course_pac(course_id)`** (function): for the authenticated user,
  returns the caller plus each accepted friend with their **PAC/division for
  that course** (course-context attempts only, never room XP). `SECURITY
  DEFINER` so it can aggregate friends' owner-scoped attempts, but it only ever
  discloses the caller and their accepted friends, and only the aggregate PAC.
- **Room ranking** is read directly from `room_members.xp_internal` (RLS already
  scopes rows to the room's educator and active members); the client sorts by
  `xp_internal` descending among `status = 'active'` members.

### Room PAC visibility

The `rooms.pac_visibility` column (`members` | `educator_only` | `public`) is a
**room-level** setting. The educator always sees every member's PAC and each
student always sees their own; `pac_visibility` controls whether a student can
also see **other** students' PAC. Per-member PAC visibility is intentionally not
modeled in the MVP schema — the toggle is room-level.

### `finalize_attempt` context rules

- **Course context** (`attempt.room_id IS NULL`): adds `xp_earned` to
  `profiles.xp_global`, recomputes `level`, updates `enrollments.progress`.
- **Room context** (`attempt.room_id IS NOT NULL`): updates
  `room_members.xp_internal / progress / pac_internal` **only**. It never
  touches global XP.

In both cases it grades every stored answer, writes
`correct_count / total_count / xp_earned`, inserts a `completions` row when all
of the lesson's questions have been answered, then calls `touch_streak` and
`grant_medals`.

## Question `config` jsonb shapes

The grader reads these exact shapes. The client submits the matching
`submitted` jsonb when inserting into `answers`.

### `match`
```jsonc
// config
{ "pairs": [ { "left": "Sol", "right": "Estrela" }, { "left": "Terra", "right": "Planeta" } ] }
// submitted
{ "pairs": [ { "left": "Sol", "right": "Estrela" } ] }
```
Grading: proportional partial XP = `xp_value * correct_pairs / total_pairs`
(floored). `is_correct` only when every pair matches.

### `multiple_choice`
```jsonc
// config  (correct ids = options with correct=true)
{ "options": [ { "id": "a", "text": "..", "correct": true }, { "id": "b", "text": "..", "correct": false } ] }
// submitted
{ "selected": ["a"] }
```
Grading: exact set match of selected vs correct ids. Any extra or missing
selection is wrong. **No partial XP** (all-or-nothing).

### `fill_blank`
```jsonc
// config  (any accepted spelling)
{ "answers": ["Paris", "paris"] }
// submitted
{ "text": "  PÁRIS " }
```
Grading: normalize both sides (lower + `unaccent` + trim + collapse spaces);
correct if the submission matches **any** configured answer. All-or-nothing.

### `sum_alternatives`
```jsonc
// config  (expected optional; defaults to the sum of correct values)
{ "statements": [ { "value": 1, "correct": true }, { "value": 4, "correct": true } ], "expected": 5 }
// submitted
{ "sum": 5 }
```
Grading: correct if `submitted.sum` equals the expected numeric sum.
All-or-nothing.

## `/crud` and admin access

`/crud` admin access depends on `role = 'admin'` verified **server-side** via
`public.is_admin()`, not merely on having a session. Admin-only mutations use
`is_admin()`-gated policies (or the service role for catalog seeding).
