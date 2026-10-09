import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorText } from '@/components/ui/ErrorText';
import { formatError } from '@/lib/errors';
import {
  useCatalog,
  useEnroll,
  useMyCreatedCourses,
  useMyEnrollments,
  type CatalogCourse,
} from './api';
import { EMPTY_FILTERS, type CatalogFilters } from './helpers';
import { CourseCard } from './CourseCard';
import { CourseDetailModal } from './CourseDetailModal';

type Tab = 'all' | 'enrolled' | 'created';

const TAB_LABELS: Record<Tab, string> = {
  all: 'Todos',
  enrolled: 'Matriculados',
  created: 'Criados por mim',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
  gap: '1rem',
  marginTop: '1rem',
};

/**
 * Authenticated catalog: search + combinable tag/category filters, three
 * sections (Todos / Matriculados / Criados por mim), incremental "Ver mais"
 * pagination, and the course-details overlay popup.
 */
export function CatalogPage() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const userId = session?.user?.id;

  const [tab, setTab] = useState<Tab>('all');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  // Accumulated items for "Ver mais". We keep a simple local list and merge
  // each loaded page by offset.
  const [items, setItems] = useState<CatalogCourse[]>([]);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  const catalogQuery = useCatalog(filters, offset);
  const enrollmentsQuery = useMyEnrollments(userId);
  const createdQuery = useMyCreatedCourses(userId);
  const enroll = useEnroll();

  // Merge loaded pages into the accumulated list.
  const page = catalogQuery.data;
  useEffect(() => {
    if (!page) return;
    setItems((prev) => {
      if (offset === 0) return page.items;
      // Avoid duplicates when the same offset resolves twice.
      const seen = new Set(prev.map((i) => i.course.id));
      return [...prev, ...page.items.filter((i) => !seen.has(i.course.id))];
    });
  }, [page, offset]);

  const enrolledCourseIds = useMemo(
    () => new Set((enrollmentsQuery.data ?? []).map((e) => e.course.id)),
    [enrollmentsQuery.data],
  );

  function applyFilters(next: Partial<CatalogFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setOffset(0);
    setItems([]);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ search: searchInput });
  }

  async function handleEnroll(courseId: string) {
    if (!userId) return;
    try {
      await enroll.mutateAsync({ userId, courseId });
      toast.success('Matrícula realizada!');
    } catch (err) {
      toast.error(formatError(err, 'Não foi possível matricular no curso'));
    }
  }

  // Derive available tags/categories from loaded + enrolled + created courses.
  const { categories, tags } = useMemo(() => {
    const cats = new Set<string>();
    const tgs = new Set<string>();
    const sources = [
      ...items.map((i) => i.course),
      ...(enrollmentsQuery.data ?? []).map((e) => e.course),
      ...(createdQuery.data ?? []),
    ];
    for (const c of sources) {
      if (c.category) cats.add(c.category);
      for (const t of c.tags ?? []) tgs.add(t);
    }
    return {
      categories: Array.from(cats).sort(),
      tags: Array.from(tgs).sort(),
    };
  }, [items, enrollmentsQuery.data, createdQuery.data]);

  return (
    <div>
      <h1 style={{ color: 'var(--brand-purple)' }}>Catálogo</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '-0.5rem' }}>
        Explore cursos públicos, continue os seus e gerencie os que você criou.
      </p>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </Button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/create')}
          >
            + Criar curso
          </Button>
        </div>
      </div>

      {/* Search + filters (apply to the "Todos" tab) */}
      {tab === 'all' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'flex-end',
          }}
        >
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              gap: '0.5rem',
              flex: 1,
              minWidth: '14rem',
            }}
          >
            <Input
              placeholder="Buscar por título, criador, tag..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: '100%' }}
            />
            <Button type="submit" size="sm">
              Buscar
            </Button>
          </form>

          <select
            aria-label="Filtrar por categoria"
            value={filters.category ?? ''}
            onChange={(e) => applyFilters({ category: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por tag"
            value={filters.tag ?? ''}
            onChange={(e) => applyFilters({ tag: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">Todas as tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>

          {(filters.search || filters.tag || filters.category) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                applyFilters(EMPTY_FILTERS);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Tab content */}
      {tab === 'all' && (
        <>
          {catalogQuery.isError && (
            <div style={{ marginTop: '1rem' }}>
              <ErrorText>
                {formatError(
                  catalogQuery.error,
                  'Não foi possível carregar o catálogo',
                )}
              </ErrorText>
            </div>
          )}
          <div style={gridStyle}>
            {items.map((item) => (
              <CourseCard
                key={item.course.id}
                title={item.course.title}
                creatorName={item.creatorName}
                studentCount={item.studentCount}
                category={item.course.category}
                tags={item.course.tags}
                enrolled={enrolledCourseIds.has(item.course.id)}
                onOpen={() => setOpenCourseId(item.course.id)}
                onEnroll={() => handleEnroll(item.course.id)}
                enrolling={enroll.isPending}
              />
            ))}
          </div>
          {catalogQuery.isLoading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
            >
              <Spinner size={28} />
            </div>
          )}
          {!catalogQuery.isLoading && items.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', marginTop: '1rem' }}>
              Nenhum curso encontrado.
            </p>
          )}
          {page?.hasMore && !catalogQuery.isLoading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '1.25rem',
              }}
            >
              <Button
                variant="ghost"
                onClick={() => setOffset(page.nextOffset)}
              >
                Ver mais
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'enrolled' && (
        <>
          {enrollmentsQuery.isLoading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
            >
              <Spinner size={28} />
            </div>
          )}
          <div style={gridStyle}>
            {(enrollmentsQuery.data ?? []).map((e) => (
              <CourseCard
                key={e.course.id}
                title={e.course.title}
                creatorName={e.creatorName}
                studentCount={0}
                progress={e.enrollment.progress}
                enrolled
                category={e.course.category}
                tags={e.course.tags}
                onOpen={() => setOpenCourseId(e.course.id)}
              />
            ))}
          </div>
          {!enrollmentsQuery.isLoading &&
            (enrollmentsQuery.data ?? []).length === 0 && (
              <p
                style={{ color: 'var(--color-text-muted)', marginTop: '1rem' }}
              >
                Você ainda não se matriculou em nenhum curso.
              </p>
            )}
        </>
      )}

      {tab === 'created' && (
        <>
          {createdQuery.isLoading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
            >
              <Spinner size={28} />
            </div>
          )}
          <div style={gridStyle}>
            {(createdQuery.data ?? []).map((c) => (
              <CourseCard
                key={c.id}
                title={c.title}
                creatorName="Você"
                studentCount={c.studentCount}
                status={c.status}
                category={c.category}
                tags={c.tags}
                enrolled={enrolledCourseIds.has(c.id)}
                onOpen={() => setOpenCourseId(c.id)}
                onEnroll={() => handleEnroll(c.id)}
                enrolling={enroll.isPending}
                onEdit={() => navigate(`/create/${c.id}`)}
              />
            ))}
          </div>
          {!createdQuery.isLoading &&
            (createdQuery.data ?? []).length === 0 && (
              <p
                style={{ color: 'var(--color-text-muted)', marginTop: '1rem' }}
              >
                Você ainda não criou cursos.{' '}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/create')}
                >
                  Criar o primeiro
                </Button>
              </p>
            )}
        </>
      )}

      <CourseDetailModal
        courseId={openCourseId}
        onClose={() => setOpenCourseId(null)}
      />
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '0.95rem',
};

export default CatalogPage;
