import { describe, expect, it } from 'vitest';
import {
  averageRating,
  buildCatalogPredicate,
  canEditExistingContent,
  courseDetailToDraft,
  EMPTY_FILTERS,
  hasActiveFilters,
  hasNewModule,
  isExistingContentLocked,
  nextModulePosition,
  slugify,
  type SearchableCourse,
} from '../helpers';
import type { CourseDetail } from '../api';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips accents and diacritics', () => {
    expect(slugify('Introdução à Programação')).toBe(
      'introducao-a-programacao',
    );
    expect(slugify('Café com Leite')).toBe('cafe-com-leite');
  });

  it('collapses runs of non-alphanumeric characters', () => {
    expect(slugify('a   b---c!!!d')).toBe('a-b-c-d');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Olá, Mundo!--  ')).toBe('ola-mundo');
  });

  it('keeps digits', () => {
    expect(slugify('React 18 e Vite 5')).toBe('react-18-e-vite-5');
  });

  it('returns an empty string for symbol-only input', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('is idempotent on an already-slugged value', () => {
    const once = slugify('Álgebra Linear II');
    expect(slugify(once)).toBe(once);
  });
});

const COURSES: SearchableCourse[] = [
  {
    title: 'Introdução à Programação',
    slug: 'introducao-a-programacao',
    description: 'Lógica e primeiros passos em código.',
    category: 'Tecnologia',
    tags: ['python', 'iniciante'],
    creatorName: 'Ana Lima',
  },
  {
    title: 'Cálculo I',
    slug: 'calculo-i',
    description: 'Limites, derivadas e integrais.',
    category: 'Matemática',
    tags: ['exatas', 'iniciante'],
    creatorName: 'Bruno Souza',
  },
  {
    title: 'História do Brasil',
    slug: 'historia-do-brasil',
    description: 'Do descobrimento à república.',
    category: 'Humanas',
    tags: ['brasil'],
    creatorName: 'Ana Lima',
  },
];

function filter(partial: Partial<Parameters<typeof buildCatalogPredicate>[0]>) {
  return COURSES.filter(
    buildCatalogPredicate({ ...EMPTY_FILTERS, ...partial }),
  );
}

describe('buildCatalogPredicate', () => {
  it('matches everything when no filter is active', () => {
    expect(filter({})).toHaveLength(COURSES.length);
  });

  it('searches the title case- and accent-insensitively', () => {
    const result = filter({ search: 'introducao' });
    expect(result.map((c) => c.slug)).toEqual(['introducao-a-programacao']);
  });

  it('searches the description', () => {
    const result = filter({ search: 'derivadas' });
    expect(result.map((c) => c.slug)).toEqual(['calculo-i']);
  });

  it('searches tags', () => {
    const result = filter({ search: 'python' });
    expect(result.map((c) => c.slug)).toEqual(['introducao-a-programacao']);
  });

  it('searches the creator name', () => {
    const result = filter({ search: 'bruno' });
    expect(result.map((c) => c.slug)).toEqual(['calculo-i']);
  });

  it('matches a term that occurs ONLY in the creator name', () => {
    // "souza" is not part of any title/slug/description/category/tag, so a hit
    // can only come from the creator name. Mirrors the server creator-name
    // search refinement.
    const result = filter({ search: 'souza' });
    expect(result.map((c) => c.slug)).toEqual(['calculo-i']);
  });

  it('matches the creator name case- and accent-insensitively', () => {
    // "LÍMA" differs from the stored "Lima" by case and an accent; both of
    // Ana Lima's courses must match.
    const result = filter({ search: 'LÍMA' });
    expect(result.map((c) => c.slug).sort()).toEqual([
      'historia-do-brasil',
      'introducao-a-programacao',
    ]);
  });

  it('searches the slug', () => {
    const result = filter({ search: 'historia-do' });
    expect(result.map((c) => c.slug)).toEqual(['historia-do-brasil']);
  });

  it('filters by exact category', () => {
    const result = filter({ category: 'Matemática' });
    expect(result.map((c) => c.slug)).toEqual(['calculo-i']);
  });

  it('filters by tag', () => {
    const result = filter({ tag: 'iniciante' });
    expect(result.map((c) => c.slug).sort()).toEqual([
      'calculo-i',
      'introducao-a-programacao',
    ]);
  });

  it('combines tag and category filters (AND)', () => {
    const result = filter({ tag: 'iniciante', category: 'Tecnologia' });
    expect(result.map((c) => c.slug)).toEqual(['introducao-a-programacao']);
  });

  it('combines search with tag and category filters', () => {
    const result = filter({
      search: 'ana',
      tag: 'iniciante',
      category: 'Tecnologia',
    });
    expect(result.map((c) => c.slug)).toEqual(['introducao-a-programacao']);
  });

  it('returns nothing when combined filters have no intersection', () => {
    const result = filter({ tag: 'brasil', category: 'Matemática' });
    expect(result).toHaveLength(0);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filter state', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('is true when search is non-empty', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'x' })).toBe(true);
  });

  it('is true when a tag is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tag: 'python' })).toBe(true);
  });

  it('is true when a category is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: 'Humanas' })).toBe(
      true,
    );
  });
});

describe('averageRating', () => {
  it('returns 0 for an empty list', () => {
    expect(averageRating([])).toBe(0);
  });

  it('averages and rounds to one decimal', () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([5, 0])).toBe(2.5);
  });
});

describe('isExistingContentLocked', () => {
  it('is false for a brand-new course being created (not yet persisted)', () => {
    // Creation flow: no draft.id, status draft -> fully editable.
    expect(
      isExistingContentLocked({ isExistingCourse: false, status: 'draft' }),
    ).toBe(false);
  });

  it('is false for a brand-new course being published for the first time', () => {
    // Publishing from the creation flow is still unlocked (nothing pre-exists).
    expect(
      isExistingContentLocked({ isExistingCourse: false, status: 'published' }),
    ).toBe(false);
  });

  it('is false for an existing DRAFT course (fully editable)', () => {
    expect(
      isExistingContentLocked({ isExistingCourse: true, status: 'draft' }),
    ).toBe(false);
  });

  it('is true for an existing PUBLISHED course (content immutable)', () => {
    expect(
      isExistingContentLocked({ isExistingCourse: true, status: 'published' }),
    ).toBe(true);
  });
});

describe('canEditExistingContent', () => {
  it('allows editing an existing draft course', () => {
    expect(
      canEditExistingContent({ isExistingCourse: true, status: 'draft' }),
    ).toBe(true);
  });

  it('locks editing pre-existing content of a published course', () => {
    // Existing content is locked; brand-new modules can still be added, which
    // the UI gates on each entity's persisted flag, not on this helper.
    expect(
      canEditExistingContent({ isExistingCourse: true, status: 'published' }),
    ).toBe(false);
  });

  it('allows editing while still creating a new course', () => {
    expect(
      canEditExistingContent({ isExistingCourse: false, status: 'draft' }),
    ).toBe(true);
  });
});

describe('nextModulePosition', () => {
  it('starts at 0 when there are no retained modules', () => {
    // Brand-new course or a draft rebuilt from scratch: dense 0..n sequence.
    expect(nextModulePosition([])).toBe(0);
  });

  it('appends after the max retained position (contiguous)', () => {
    // Three retained modules at 0,1,2 -> the next new module goes to 3, which
    // does NOT collide with any retained position.
    expect(nextModulePosition([0, 1, 2])).toBe(3);
  });

  it('derives from the MAX, not the count, when positions have gaps', () => {
    // A published course whose stored positions are sparse (e.g. after an
    // earlier edit) must still get a non-colliding position: count would be 3
    // and collide with the retained position 5, so max+1 = 6 is required.
    expect(nextModulePosition([0, 2, 5])).toBe(6);
  });

  it('does not collide across successive appends (caller increments)', () => {
    // The caller appends the just-assigned position and asks again; each new
    // module gets a distinct, non-colliding slot.
    const existing = [0, 1, 2];
    const first = nextModulePosition(existing);
    const second = nextModulePosition([...existing, first]);
    expect(first).toBe(3);
    expect(second).toBe(4);
    expect(new Set([...existing, first, second]).size).toBe(5);
  });

  it('handles a single retained module', () => {
    expect(nextModulePosition([7])).toBe(8);
  });
});

describe('hasNewModule', () => {
  it('is false when every module is already persisted', () => {
    // Published-course edit with no new module -> save would be a zero-write.
    expect(hasNewModule([{ id: 'm1' }, { id: 'm2' }])).toBe(false);
  });

  it('is true when at least one module has no id', () => {
    expect(hasNewModule([{ id: 'm1' }, {}])).toBe(true);
  });

  it('is true when a module id is undefined', () => {
    expect(hasNewModule([{ id: undefined }])).toBe(true);
  });

  it('is false for an empty list', () => {
    // `some` is vacuously false; the editor's own validate() rejects an empty
    // module list before the guard is ever reached, so this is just defensive.
    expect(hasNewModule([])).toBe(false);
  });
});

describe('courseDetailToDraft', () => {
  // A representative loaded course tree. Only the fields the transform reads
  // are modelled; the rest of the Row columns are irrelevant here, so the
  // fixture is cast to CourseDetail at the boundary.
  function buildDetail(
    overrides: Partial<CourseDetail['course']> = {},
  ): CourseDetail {
    return {
      course: {
        id: 'course-1',
        creator_id: 'user-1',
        title: 'Introdução à Programação',
        slug: 'introducao-a-programacao',
        description: 'Lógica e primeiros passos.',
        category: 'Tecnologia',
        tags: ['python', 'iniciante'],
        cover_url: null,
        status: 'published',
        visibility: 'public',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        ...overrides,
      },
      creator: null,
      modules: [
        {
          module: {
            id: 'module-1',
            course_id: 'course-1',
            title: 'Módulo 1',
            description: 'Fundamentos',
            position: 0,
            color: '#123456',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          lessons: [
            {
              lesson: {
                id: 'lesson-1',
                module_id: 'module-1',
                title: 'Aula 1',
                content: 'Conteúdo da aula',
                position: 0,
                status: 'published',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              questions: [
                {
                  id: 'question-1',
                  lesson_id: 'lesson-1',
                  type: 'multiple_choice',
                  prompt: 'Qual a resposta?',
                  position: 0,
                  config: { options: ['a', 'b'], correctIndex: 1 },
                  xp_value: 25,
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              ],
            },
          ],
        },
      ],
      averageRating: 0,
      reviewCount: 0,
      recentComments: [],
      studentCount: 0,
      firstLessonId: 'lesson-1',
    } as unknown as CourseDetail;
  }

  it('maps the course fields including id, status and visibility', () => {
    const draft = courseDetailToDraft(buildDetail());
    expect(draft.id).toBe('course-1');
    expect(draft.title).toBe('Introdução à Programação');
    expect(draft.slug).toBe('introducao-a-programacao');
    expect(draft.status).toBe('published');
    expect(draft.visibility).toBe('public');
  });

  it('preserves persisted ids and positions through the whole tree', () => {
    const draft = courseDetailToDraft(buildDetail());
    const module = draft.modules[0];
    const lesson = module.lessons[0];
    const question = lesson.questions[0];
    expect(module.id).toBe('module-1');
    expect(module.position).toBe(0);
    expect(lesson.id).toBe('lesson-1');
    expect(lesson.position).toBe(0);
    expect(question.id).toBe('question-1');
    expect(question.position).toBe(0);
  });

  it('carries question config (Json) and maps xp_value -> xpValue', () => {
    const draft = courseDetailToDraft(buildDetail());
    const question = draft.modules[0].lessons[0].questions[0];
    expect(question.config).toEqual({ options: ['a', 'b'], correctIndex: 1 });
    expect(question.xpValue).toBe(25);
    expect(question.type).toBe('multiple_choice');
  });

  it('maps a null description/category to an empty string', () => {
    const draft = courseDetailToDraft(
      buildDetail({ description: null, category: null }),
    );
    expect(draft.description).toBe('');
    expect(draft.category).toBe('');
  });

  it('maps null lesson content to an empty string', () => {
    const detail = buildDetail();
    detail.modules[0].lessons[0].lesson.content = null;
    const draft = courseDetailToDraft(detail);
    expect(draft.modules[0].lessons[0].content).toBe('');
  });

  it('preserves tags and a private visibility', () => {
    const draft = courseDetailToDraft(
      buildDetail({ tags: ['a', 'b', 'c'], visibility: 'private' }),
    );
    expect(draft.tags).toEqual(['a', 'b', 'c']);
    expect(draft.visibility).toBe('private');
  });

  it('maps a draft course status', () => {
    const draft = courseDetailToDraft(buildDetail({ status: 'draft' }));
    expect(draft.status).toBe('draft');
  });
});
