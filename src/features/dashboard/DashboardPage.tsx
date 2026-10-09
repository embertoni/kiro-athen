/**
 * Dashboard — the learner's home (Painel) and the application's main page.
 *
 * The central area is a horizontal, Duolingo-style trail for the selected
 * course (or the selected room's course): SQUARE module nodes and CIRCLE lesson
 * nodes laid out left-to-right in course order. The trail layer sits BEHIND the
 * overlay UI (selector, top-down panel, carousel, notice board) and can be
 * dragged / wheel-scrolled horizontally. All completion/locking state is
 * server-authoritative (useCourseTrail); there is no fake completion state.
 *
 * Overlay UI:
 * - Top-left: a Cursos/Salas selector + a course/room picker that swaps the
 *   trail being shown.
 * - Top-right: a button that opens a "top-down" panel sliding from the top.
 *     Cursos mode  -> friends ranking by PAC for the course + global daily
 *                     missions (client-derived, display only).
 *     Salas mode   -> room ranking (when enabled by pac_visibility) + room
 *                     missions.
 * - Bottom: a module carousel to focus/scroll the trail to a module.
 * - Bottom-right (Salas mode only): the room notice board (announcements).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { useAuth } from '@/features/auth/AuthProvider';
import { FriendsCourseRanking } from '@/features/rankings/FriendsCourseRanking';
import {
  useAnnouncements,
  useMissions,
  useMyRooms,
  useRoomMembers,
} from '@/features/rooms/api';
import { pacDisplay, sortByXpDesc } from '@/features/rooms/helpers';
import { useCourseTrail, useDashboardOverview, type CourseTrail } from './api';
import { deriveDailyMissions } from './helpers';
import { useHorizontalDragScroll } from './useHorizontalDragScroll';

type Mode = 'cursos' | 'salas';

export function DashboardPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;

  const overviewQuery = useDashboardOverview(userId);
  const overview = overviewQuery.data;
  const roomsQuery = useMyRooms(userId);

  const [mode, setMode] = useState<Mode>('cursos');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusedModuleId, setFocusedModuleId] = useState<string | null>(null);

  // The rooms the user can pick from (educator + member).
  const myRooms = useMemo(() => {
    const r = roomsQuery.data;
    if (!r) return [];
    return [...r.asEducator, ...r.asMember];
  }, [roomsQuery.data]);

  // Default the course trail to the last studied course, else first enrollment.
  useEffect(() => {
    if (selectedCourseId || !overview) return;
    const next =
      overview.lastStudied?.courseId ??
      overview.enrollments[0]?.course.id ??
      null;
    if (next) setSelectedCourseId(next);
  }, [overview, selectedCourseId]);

  // Default the room selection to the first room the user belongs to.
  useEffect(() => {
    if (selectedRoomId || myRooms.length === 0) return;
    setSelectedRoomId(myRooms[0].room.id);
  }, [myRooms, selectedRoomId]);

  const selectedRoom = myRooms.find((r) => r.room.id === selectedRoomId);
  // In Salas mode the trail follows the room's linked course.
  const activeCourseId =
    mode === 'salas'
      ? (selectedRoom?.room.course_id ?? null)
      : selectedCourseId;

  const trailQuery = useCourseTrail(userId, activeCourseId);

  // Scroll/snap the trail to a module when the carousel selection changes.
  const trailRef = useRef<HTMLDivElement | null>(null);
  const dragHandlers = useHorizontalDragScroll(trailRef);

  function scrollToModule(moduleId: string) {
    setFocusedModuleId(moduleId);
    const el = trailRef.current?.querySelector<HTMLElement>(
      `[data-module-id="${moduleId}"]`,
    );
    el?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    });
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="dash-center">
        <Spinner size={36} />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return <ErrorText>Não foi possível carregar o painel.</ErrorText>;
  }

  const trail = trailQuery.data;
  const dailyMissions = deriveDailyMissions({
    lastStudyDate:
      profile?.last_study_date ?? overview?.profile?.last_study_date,
    streakCount: profile?.streak_count ?? overview?.profile?.streak_count,
  });

  return (
    <div className="dash">
      {/* Trail layer (behind the overlay UI) */}
      <div
        className="dash__trail"
        ref={trailRef}
        {...dragHandlers}
        role="group"
        aria-label="Trilha de aulas"
      >
        {trailQuery.isLoading && (
          <div className="dash-center">
            <Spinner size={28} />
          </div>
        )}
        {trailQuery.isError && (
          <div className="dash-center">
            <ErrorText>Não foi possível carregar a trilha.</ErrorText>
          </div>
        )}
        {trail && (
          <TrailTrack
            trail={trail}
            onOpenLesson={(id) => navigate(`/lesson/${id}`)}
          />
        )}
        {!activeCourseId && !trailQuery.isLoading && (
          <div className="dash-center">
            <p style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'salas'
                ? 'Selecione uma sala para ver a trilha.'
                : 'Matricule-se em um curso para ver a trilha.'}
            </p>
          </div>
        )}
      </div>

      {/* Top-left: Cursos/Salas selector + picker */}
      <div className="dash__selector">
        <div className="dash__mode" role="tablist" aria-label="Modo de trilha">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cursos'}
            className={
              mode === 'cursos'
                ? 'dash__mode-btn dash__mode-btn--active'
                : 'dash__mode-btn'
            }
            onClick={() => setMode('cursos')}
          >
            Cursos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'salas'}
            className={
              mode === 'salas'
                ? 'dash__mode-btn dash__mode-btn--active'
                : 'dash__mode-btn'
            }
            onClick={() => setMode('salas')}
          >
            Salas
          </button>
        </div>

        {mode === 'cursos' ? (
          <select
            className="dash__picker"
            aria-label="Selecionar curso"
            value={selectedCourseId ?? ''}
            onChange={(e) => setSelectedCourseId(e.target.value || null)}
          >
            {(overview?.enrollments ?? []).length === 0 && (
              <option value="">Sem cursos</option>
            )}
            {(overview?.enrollments ?? []).map((e) => (
              <option key={e.course.id} value={e.course.id}>
                {e.course.title}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="dash__picker"
            aria-label="Selecionar sala"
            value={selectedRoomId ?? ''}
            onChange={(e) => setSelectedRoomId(e.target.value || null)}
          >
            {myRooms.length === 0 && <option value="">Sem salas</option>}
            {myRooms.map((r) => (
              <option key={r.room.id} value={r.room.id}>
                {r.room.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Top-right: open the top-down panel */}
      <button
        type="button"
        className="dash__panel-toggle"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((o) => !o)}
      >
        {panelOpen ? '✕ Fechar' : 'ℹ️ Detalhes'}
      </button>

      {/* Top-down panel */}
      <section
        className={
          panelOpen ? 'dash__topdown dash__topdown--open' : 'dash__topdown'
        }
        aria-hidden={!panelOpen}
      >
        <div className="dash__topdown-inner">
          {mode === 'cursos' ? (
            <CursosPanel courseId={activeCourseId} missions={dailyMissions} />
          ) : (
            <SalasPanel roomSummary={selectedRoom} />
          )}
        </div>
      </section>

      {/* Bottom: module carousel */}
      {trail && trail.modules.length > 0 && (
        <div
          className="dash__carousel"
          role="tablist"
          aria-label="Módulos do curso"
        >
          {trail.modules.map((m) => (
            <button
              key={m.module.id}
              type="button"
              role="tab"
              aria-selected={focusedModuleId === m.module.id}
              className={
                focusedModuleId === m.module.id
                  ? 'dash__carousel-item dash__carousel-item--active'
                  : 'dash__carousel-item'
              }
              style={{
                borderColor: m.module.color ?? 'var(--brand-purple)',
              }}
              onClick={() => scrollToModule(m.module.id)}
            >
              {m.module.title}
            </button>
          ))}
        </div>
      )}

      {/* Bottom-right: notice board (Salas mode only) */}
      {mode === 'salas' && selectedRoomId && (
        <NoticeBoard roomId={selectedRoomId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trail track (modules = squares, lessons = circles)
// ---------------------------------------------------------------------------

function TrailTrack({
  trail,
  onOpenLesson,
}: {
  trail: CourseTrail;
  onOpenLesson: (lessonId: string) => void;
}) {
  return (
    <div className="dash__track">
      {trail.modules.map((m) => (
        <div
          key={m.module.id}
          className="dash__module"
          data-module-id={m.module.id}
        >
          <div
            className="dash__module-node"
            style={{ background: m.module.color ?? 'var(--brand-purple)' }}
            title={m.module.title}
          >
            {m.module.title}
          </div>
          <div className="dash__lessons">
            {m.lessons.map((l) => {
              const state = l.locked
                ? 'locked'
                : l.completed
                  ? 'completed'
                  : 'available';
              return (
                <button
                  key={l.lesson.id}
                  type="button"
                  disabled={l.locked}
                  className={`dash__lesson dash__lesson--${state}`}
                  aria-label={`${l.lesson.title} — ${
                    l.locked
                      ? 'bloqueada'
                      : l.completed
                        ? 'concluída'
                        : 'disponível'
                  }`}
                  title={l.lesson.title}
                  onClick={() => !l.locked && onOpenLesson(l.lesson.id)}
                >
                  <span aria-hidden="true" className="dash__lesson-icon">
                    {l.locked ? '🔒' : l.completed ? '✓' : '▶'}
                  </span>
                  <span className="dash__lesson-title">{l.lesson.title}</span>
                </button>
              );
            })}
            {m.lessons.length === 0 && (
              <span className="dash__empty">Sem aulas</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-down panel contents
// ---------------------------------------------------------------------------

function CursosPanel({
  courseId,
  missions,
}: {
  courseId: string | null;
  missions: ReturnType<typeof deriveDailyMissions>;
}) {
  return (
    <div className="dash__panel-grid">
      <div>
        <FriendsCourseRanking courseId={courseId} />
      </div>
      <div>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
          Missões diárias
        </h2>
        <p
          style={{
            margin: '0 0 0.6rem',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
          }}
        >
          Metas do dia derivadas do seu progresso (sem XP extra).
        </p>
        <ul className="dash__missions">
          {missions.map((mi) => (
            <li
              key={mi.id}
              className={
                mi.done ? 'dash__mission dash__mission--done' : 'dash__mission'
              }
            >
              <span aria-hidden="true">{mi.done ? '✅' : '⬜'}</span>
              <span>{mi.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SalasPanel({
  roomSummary,
}: {
  roomSummary:
    { room: { id: string; name: string; pac_visibility: string } } | undefined;
}) {
  if (!roomSummary) {
    return (
      <p style={{ color: 'var(--color-text-muted)' }}>
        Selecione uma sala para ver o ranking e as missões.
      </p>
    );
  }
  return (
    <div className="dash__panel-grid">
      <RoomRanking
        roomId={roomSummary.room.id}
        visibility={roomSummary.room.pac_visibility}
      />
      <RoomMissions roomId={roomSummary.room.id} />
    </div>
  );
}

function RoomRanking({
  roomId,
  visibility,
}: {
  roomId: string;
  visibility: string;
}) {
  const membersQuery = useRoomMembers(roomId, true);
  // Only members may see the roster ranking; educator_only hides it from the
  // learner-facing dashboard panel.
  const rankingVisible = visibility === 'members' || visibility === 'public';

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
        Ranking da sala
      </h2>
      {!rankingVisible ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          O ranking desta sala não está visível para os participantes.
        </p>
      ) : membersQuery.isLoading ? (
        <Spinner size={22} />
      ) : membersQuery.isError ? (
        <ErrorText>Não foi possível carregar o ranking da sala.</ErrorText>
      ) : (
        <ol className="dash__room-rank">
          {sortByXpDesc(
            (membersQuery.data ?? []).map((m) => ({
              xp: m.member.xp_internal,
              name: m.profile?.display_name || m.profile?.username || 'Membro',
              pac: m.member.pac_internal,
              key: m.member.id,
            })),
          ).map((m, i) => {
            const d = pacDisplay(m.pac);
            return (
              <li key={m.key} className="dash__room-rank-item">
                <span className="dash__room-rank-pos">{i + 1}</span>
                <strong style={{ flex: 1, minWidth: 0 }}>{m.name}</strong>
                <span
                  className="dash__division"
                  style={{ background: d.color }}
                >
                  {d.division}
                </span>
                <span>{m.xp} XP</span>
              </li>
            );
          })}
          {(membersQuery.data ?? []).length === 0 && (
            <li style={{ color: 'var(--color-text-muted)' }}>
              Sem membros ativos ainda.
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function RoomMissions({ roomId }: { roomId: string }) {
  const missionsQuery = useMissions(roomId);
  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
        Missões da sala
      </h2>
      {missionsQuery.isLoading ? (
        <Spinner size={22} />
      ) : missionsQuery.isError ? (
        <ErrorText>Não foi possível carregar as missões.</ErrorText>
      ) : (
        <ul className="dash__missions">
          {(missionsQuery.data ?? []).map((m) => (
            <li key={m.mission.id} className="dash__mission">
              <span aria-hidden="true">🎯</span>
              <span>
                <strong>{m.mission.title}</strong>
                {m.mission.description && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {m.mission.description}
                  </span>
                )}
              </span>
            </li>
          ))}
          {(missionsQuery.data ?? []).length === 0 && (
            <li style={{ color: 'var(--color-text-muted)' }}>
              Nenhuma missão nesta sala.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function NoticeBoard({ roomId }: { roomId: string }) {
  const query = useAnnouncements(roomId);
  return (
    <aside className="dash__notice" aria-label="Quadro de avisos">
      <h3 className="dash__notice-title">📌 Quadro de avisos</h3>
      {query.isLoading ? (
        <Spinner size={20} />
      ) : query.isError ? (
        <ErrorText>Não foi possível carregar os avisos.</ErrorText>
      ) : (
        <ul className="dash__notice-list">
          {(query.data ?? []).slice(0, 4).map((a) => (
            <li key={a.announcement.id} className="dash__notice-item">
              <strong>{a.announcement.title}</strong>
              {a.announcement.content && (
                <p className="dash__notice-content">{a.announcement.content}</p>
              )}
              <span className="dash__notice-author">— {a.authorName}</span>
            </li>
          ))}
          {(query.data ?? []).length === 0 && (
            <li
              style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
            >
              Nenhum aviso ainda.
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}

export default DashboardPage;
