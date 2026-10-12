/**
 * Dashboard — the learner's home (Painel) and the application's main page.
 *
 * The central area is a horizontal, Duolingo-style trail for the selected
 * course (or the selected room's course): SQUARE module nodes and CIRCLE lesson
 * nodes absolutely positioned along a repeating per-module wave in course
 * order. The trail layer sits BEHIND the
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
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { Modal } from '@/components/ui/Modal';
import { formatError } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { LessonRunner } from '@/features/lesson/LessonRunner';
import { NotebookOverlay } from '@/features/notebook/NotebookOverlay';
import { FriendsCourseRanking } from '@/features/rankings/FriendsCourseRanking';
import {
  useAnnouncements,
  useMissions,
  useMyRooms,
  useRoomMembers,
} from '@/features/rooms/api';
import { pacDisplay, sortByXpDesc } from '@/features/rooms/helpers';
import { useCourseTrail, useDashboardOverview, type CourseTrail } from './api';
import {
  buildTrailGradient,
  computeCarouselWindow,
  computeCenterScrollLeft,
  computeModuleTrailPoints,
  createSmoothPath,
  nextModuleIndex,
  resolveModuleColor,
  deriveDailyMissions,
} from './helpers';
import { useHorizontalDragScroll } from './useHorizontalDragScroll';

type Mode = 'cursos' | 'salas';

export function DashboardPage() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;

  // The lesson currently open in the pop-up modal (null = closed). Clicking an
  // available lesson node opens it here instead of navigating to /lesson/:id.
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  // The loaded lesson's title, surfaced by LessonRunner, used as the modal
  // header. Null while the lesson is loading; the modal falls back to "Aula".
  const [openLessonTitle, setOpenLessonTitle] = useState<string | null>(null);

  // The floating notebook overlay (NotebookOverlay) toggled by the dashboard
  // button below. It is an ADDITIONAL surface: the /notebook full page and the
  // "Cadernos" sidebar nav item stay intact. The overlay is non-modal so the
  // dashboard stays interactive while it is open.
  const [notebookOpen, setNotebookOpen] = useState(false);

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

  // Scroll the trail so the focused module's node is centered horizontally.
  const trailRef = useRef<HTMLDivElement | null>(null);
  const dragHandlers = useHorizontalDragScroll(trailRef);

  const trail = trailQuery.data;

  // The "current" module drives the trail color: the focused module when set,
  // else the first module of the trail.
  const currentModule =
    trail?.modules.find((m) => m.module.id === focusedModuleId) ??
    trail?.modules[0];
  const currentColor = resolveModuleColor(currentModule?.module.color);
  const currentModuleId = currentModule?.module.id ?? null;
  // Per-module gradient tint for the trail layer. CSS cannot interpolate
  // between two radial-gradient images, so instead of transitioning a single
  // background-image we paint the gradient on a dedicated, absolutely
  // positioned tint layer (.dash__trail-tint) that is KEYED by the focused
  // module id. On a module switch React mounts a fresh tint layer which fades
  // its opacity in over the previous one (@keyframes dash-trail-fade), so the
  // color change genuinely cross-fades rather than snapping.
  const trailBackground = buildTrailGradient(currentColor);

  // Selecting a module (carousel/selection) focuses it; the effect below does
  // the centering so programmatic focus changes always re-center too.
  function scrollToModule(moduleId: string) {
    setFocusedModuleId(moduleId);
  }

  // Default the focused module to the first module when the trail loads or
  // changes, and recover if the focused module is no longer in the trail, so
  // the trail always has a current color even before the user interacts.
  useEffect(() => {
    if (!trail || trail.modules.length === 0) return;
    const stillPresent =
      !!focusedModuleId &&
      trail.modules.some((m) => m.module.id === focusedModuleId);
    if (!stillPresent) {
      setFocusedModuleId(trail.modules[0].module.id);
    }
  }, [trail, focusedModuleId]);

  // Center the focused module's node horizontally inside the trail container
  // whenever it changes programmatically (carousel, selection, or the default
  // effect above). Uses the SAME scroll container the drag/wheel handlers
  // mutate (trailRef), so it never conflicts with an active drag/wheel.
  //
  // The node offset is measured relative to the scroll container via
  // getBoundingClientRect + the container's current scrollLeft, rather than
  // node.offsetLeft. offsetLeft is relative to the nearest POSITIONED ancestor;
  // the track (`.dash__track`) is now position:relative so it is the offset
  // parent, but measuring from the container's own rect keeps centering correct
  // regardless of which ancestor becomes the offset parent.
  useEffect(() => {
    if (!focusedModuleId) return;
    const container = trailRef.current;
    if (!container) return;
    const node = container.querySelector<HTMLElement>(
      `[data-module-id="${focusedModuleId}"]`,
    );
    if (!node) return;
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    // Node left edge in the container's scroll coordinate space.
    const nodeOffsetLeft =
      nodeRect.left - containerRect.left + container.scrollLeft;
    const left = computeCenterScrollLeft({
      containerWidth: container.clientWidth,
      nodeOffsetLeft,
      nodeWidth: nodeRect.width,
      maxScrollLeft: container.scrollWidth - container.clientWidth,
    });
    container.scrollTo({ left, behavior: 'smooth' });
  }, [focusedModuleId, trail]);

  if (overviewQuery.isLoading) {
    return (
      <div className="dash-center">
        <Spinner size={36} />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <ErrorText>
        {formatError(overviewQuery.error, 'Não foi possível carregar o painel')}
      </ErrorText>
    );
  }

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
        style={{
          ['--trail-color' as string]: currentColor,
        }}
      >
        {/* Keyed gradient tint layer: a new layer mounts per focused module and
            fades in over the previous one for a true cross-fade (see note where
            trailBackground is built). Purely decorative, so it never captures
            pointer events. */}
        {currentModuleId && (
          <div
            key={currentModuleId}
            className="dash__trail-tint"
            aria-hidden="true"
            style={{ ['--trail-bg' as string]: trailBackground }}
          />
        )}
        {trailQuery.isLoading && (
          <div className="dash-center">
            <Spinner size={28} />
          </div>
        )}
        {trailQuery.isError && (
          <div className="dash-center">
            <ErrorText>
              {formatError(
                trailQuery.error,
                'Não foi possível carregar a trilha',
              )}
            </ErrorText>
          </div>
        )}
        {trail && (
          <TrailTrack
            trail={trail}
            currentColor={currentColor}
            focusedModuleId={focusedModuleId}
            onOpenLesson={(id) => setOpenLessonId(id)}
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

      {/* Bottom-center: 3-item module carousel (prev-arrow, [prev, current,
          next] viewport, next-arrow). Drives the EXISTING focusedModuleId
          mechanism so the trail re-centers; neighbors are dimmed via CSS. */}
      {trail && trail.modules.length > 0 && (
        <ModuleCarousel
          trail={trail}
          focusedModuleId={focusedModuleId}
          onSelect={scrollToModule}
        />
      )}

      {/* Bottom-right: notice board (Salas mode only) */}
      {mode === 'salas' && selectedRoomId && (
        <NoticeBoard roomId={selectedRoomId} />
      )}

      {/* Bottom-left: floating notebook toggle. Opens the draggable overlay
          (an additional surface; the /notebook page + "Cadernos" nav remain). */}
      <button
        type="button"
        className={
          notebookOpen
            ? 'dash__notebook-toggle dash__notebook-toggle--active'
            : 'dash__notebook-toggle'
        }
        aria-pressed={notebookOpen}
        onClick={() => setNotebookOpen((o) => !o)}
      >
        <span aria-hidden="true">📖</span>
        {notebookOpen ? 'Fechar caderno' : 'Caderno'}
      </button>

      {/* Floating notebook overlay (non-modal, draggable + resizable). */}
      {notebookOpen && (
        <NotebookOverlay onClose={() => setNotebookOpen(false)} />
      )}

      {/* Lesson pop-up: opens over the dashboard instead of navigating away.
          The runner finalizes via the server-authoritative RPC; on success
          useFinalizeLesson invalidates the dashboard queries so the trail
          behind the modal refetches (completed node + next unlock) with no
          manual reload. Closing the modal reveals the already-updated trail. */}
      <Modal
        open={openLessonId !== null}
        onClose={() => {
          setOpenLessonId(null);
          setOpenLessonTitle(null);
        }}
        title={openLessonTitle ?? 'Aula'}
        size="lg"
      >
        {openLessonId && (
          <LessonRunner
            lessonId={openLessonId}
            roomId={mode === 'salas' ? (selectedRoomId ?? undefined) : undefined}
            onTitleChange={setOpenLessonTitle}
            onDone={() => {
              setOpenLessonId(null);
              setOpenLessonTitle(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trail track (modules = squares, lessons = circles)
// ---------------------------------------------------------------------------

/*
 * Trail geometry (shared by the nodes and the SVG connector). Nodes are
 * ABSOLUTELY positioned along a REPEATING per-module wave: x advances by STEP
 * per node, y oscillates around MID_Y and the sine phase RESETS at every module
 * boundary so each module traces the same up/down shape. The connector draws
 * the SAME flattened points so the path visibly matches the node positions.
 */
const currentFallback = 'var(--brand-purple)';
const TRAIL_STEP = 150;
const TRAIL_START_X = 120;
const TRAIL_MID_Y = 170;
const TRAIL_AMPLITUDE = 92;
const TRAIL_HEIGHT = 340;
const TRAIL_PAD_RIGHT = 120;
// Half the module face (80px) / lesson face (64px) used to center a node on its
// wave point via inline left/top (the node box is positioned by its top-left).
const MODULE_HALF = 40;
const LESSON_HALF = 32;

/** A flattened trail node: a module square or one of its lesson circles. */
type TrailNode =
  | { kind: 'module'; moduleId: string; m: CourseTrail['modules'][number] }
  | {
      kind: 'lesson';
      moduleId: string;
      lesson: CourseTrail['modules'][number]['lessons'][number];
    };

function TrailTrack({
  trail,
  currentColor,
  focusedModuleId,
  onOpenLesson,
}: {
  trail: CourseTrail;
  currentColor: string;
  focusedModuleId: string | null;
  onOpenLesson: (lessonId: string) => void;
}) {
  // Flatten modules into an ordered node sequence [module, its lessons, ...].
  const nodes: TrailNode[] = [];
  for (const m of trail.modules) {
    nodes.push({ kind: 'module', moduleId: m.module.id, m });
    for (const l of m.lessons) {
      nodes.push({ kind: 'lesson', moduleId: m.module.id, lesson: l });
    }
  }

  // Repeating per-module wave: phase resets at each module boundary.
  const { points } = computeModuleTrailPoints({
    modules: trail.modules.map((m) => ({ lessonCount: m.lessons.length })),
    step: TRAIL_STEP,
    startX: TRAIL_START_X,
    midY: TRAIL_MID_Y,
    amplitude: TRAIL_AMPLITUDE,
  });

  const width =
    (points.length > 0 ? points[points.length - 1].x : TRAIL_START_X) +
    TRAIL_PAD_RIGHT;

  return (
    <div
      className="dash__track"
      style={{
        ['--trail-color' as string]: currentColor,
        width: `${width}px`,
        height: `${TRAIL_HEIGHT}px`,
      }}
    >
      <TrailConnector trail={trail} points={points} width={width} />
      {nodes.map((node, i) => {
        const point = points[i] ?? { x: TRAIL_START_X, y: TRAIL_MID_Y };
        if (node.kind === 'module') {
          const moduleColor = resolveModuleColor(node.m.module.color);
          const isActive = focusedModuleId === node.moduleId;
          return (
            <div
              key={`module-${node.moduleId}`}
              className={
                isActive
                  ? 'dash__module dash__module--active'
                  : 'dash__module'
              }
              data-module-id={node.moduleId}
              style={{
                ['--module-color' as string]: moduleColor,
                left: `${point.x - MODULE_HALF}px`,
                top: `${point.y - MODULE_HALF}px`,
              }}
            >
              <div
                className="dash__module-node"
                style={{ background: moduleColor }}
                title={node.m.module.title}
              >
                <span className="dash__module-title">
                  {node.m.module.title}
                </span>
              </div>
            </div>
          );
        }

        const l = node.lesson;
        const state = l.locked
          ? 'locked'
          : l.completed
            ? 'completed'
            : 'available';
        return (
          <button
            key={`lesson-${l.lesson.id}`}
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
            style={{
              left: `${point.x - LESSON_HALF}px`,
              top: `${point.y - LESSON_HALF}px`,
            }}
            onClick={() => !l.locked && onOpenLesson(l.lesson.id)}
          >
            <span aria-hidden="true" className="dash__lesson-icon">
              {l.locked ? '🔒' : l.completed ? '✓' : '▶'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Decorative smooth SVG connector behind the trail nodes. It draws one flowing
 * cubic-bezier path through the SAME flattened node points as the track, with
 * per-module gradient segments (each segment fades from one module color to the
 * next, falling back to --brand-purple), so the path visibly matches the node
 * positions. Geometry comes from the pure, unit-tested helpers so the math
 * stays DOM-free. Purely visual (pointer-events: none) so it never intercepts
 * clicks.
 */
function TrailConnector({
  trail,
  points,
  width,
}: {
  trail: CourseTrail;
  points: { x: number; y: number }[];
  width: number;
}) {
  if (points.length < 2) return null;

  // Map each node index to its owning module color so each path segment fades
  // between the colors of the two nodes it connects.
  const nodeColors: string[] = [];
  for (const m of trail.modules) {
    const color = resolveModuleColor(m.module.color);
    nodeColors.push(color); // module node
    for (let i = 0; i < m.lessons.length; i += 1) nodeColors.push(color);
  }

  return (
    <svg
      className="dash__connector"
      viewBox={`0 0 ${width} ${TRAIL_HEIGHT}`}
      width={width}
      height={TRAIL_HEIGHT}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          return (
            <linearGradient
              key={`seg-grad-${i}`}
              id={`dash-seg-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={p.x}
              y1={p.y}
              x2={next.x}
              y2={next.y}
            >
              <stop offset="0%" stopColor={nodeColors[i] ?? currentFallback} />
              <stop
                offset="100%"
                stopColor={nodeColors[i + 1] ?? currentFallback}
              />
            </linearGradient>
          );
        })}
      </defs>
      {points.slice(0, -1).map((p, i) => (
        <path
          key={`seg-${i}`}
          d={createSmoothPath([p, points[i + 1]])}
          fill="none"
          stroke={`url(#dash-seg-${i})`}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bottom-center module carousel (3-item window with wraparound)
// ---------------------------------------------------------------------------

function ModuleCarousel({
  trail,
  focusedModuleId,
  onSelect,
}: {
  trail: CourseTrail;
  focusedModuleId: string | null;
  onSelect: (moduleId: string) => void;
}) {
  const modules = trail.modules;
  const moduleCount = modules.length;
  const activeIndex = Math.max(
    0,
    modules.findIndex((m) => m.module.id === focusedModuleId),
  );
  const windowIndices = computeCarouselWindow({ moduleCount, activeIndex });
  const hasArrows = moduleCount > 1;

  function move(direction: -1 | 1) {
    const idx = nextModuleIndex({ moduleCount, activeIndex, direction });
    const target = modules[idx];
    if (target) onSelect(target.module.id);
  }

  return (
    <div className="dash__carousel" aria-label="Navegação entre módulos">
      {hasArrows && (
        <button
          type="button"
          className="dash__carousel-arrow"
          onClick={() => move(-1)}
          aria-label="Módulo anterior"
        >
          ‹
        </button>
      )}
      <div className="dash__carousel-viewport">
        <div className="dash__carousel-track" role="tablist">
          {windowIndices.map((moduleIndex, slot) => {
            const m = modules[moduleIndex];
            if (!m) return null;
            // In a 3-slot window the center slot is current; for a single
            // module the only slot is current.
            const isCurrent = windowIndices.length === 1 ? true : slot === 1;
            const color = resolveModuleColor(m.module.color);
            return (
              <div
                key={`${m.module.id}-${slot}`}
                className={
                  isCurrent
                    ? 'dash__carousel-item dash__carousel-item--current'
                    : 'dash__carousel-item'
                }
                style={{ ['--module-color' as string]: color }}
              >
                <span
                  className="dash__carousel-name"
                  style={{ color, borderColor: color }}
                  title={m.module.title}
                >
                  {m.module.title}
                </span>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  className="dash__carousel-button"
                  style={{
                    borderColor: color,
                    background: isCurrent
                      ? `linear-gradient(145deg, ${color}, ${color}bb)`
                      : 'transparent',
                    boxShadow: isCurrent ? `0 0 20px ${color}66` : 'none',
                  }}
                  onClick={() => onSelect(m.module.id)}
                  aria-label={`Selecionar módulo ${m.module.title}`}
                >
                  <span className="dash__carousel-initial" aria-hidden="true">
                    {m.module.title.trim().charAt(0).toUpperCase() || '•'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {hasArrows && (
        <button
          type="button"
          className="dash__carousel-arrow"
          onClick={() => move(1)}
          aria-label="Próximo módulo"
        >
          ›
        </button>
      )}
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
  // Only members may see the roster ranking; educator_only hides it from the
  // learner-facing dashboard panel.
  const rankingVisible = visibility === 'members' || visibility === 'public';
  // Skip the roster fetch entirely when the ranking is hidden.
  const membersQuery = useRoomMembers(roomId, true, rankingVisible);

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
        <ErrorText>
          {formatError(
            membersQuery.error,
            'Não foi possível carregar o ranking da sala',
          )}
        </ErrorText>
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
        <ErrorText>
          {formatError(
            missionsQuery.error,
            'Não foi possível carregar as missões',
          )}
        </ErrorText>
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
        <ErrorText>
          {formatError(query.error, 'Não foi possível carregar os avisos')}
        </ErrorText>
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
