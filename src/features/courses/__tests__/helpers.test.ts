import { describe, expect, it } from 'vitest';
import {
  averageRating,
  buildCatalogPredicate,
  EMPTY_FILTERS,
  hasActiveFilters,
  slugify,
  type SearchableCourse,
} from '../helpers';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips accents and diacritics', () => {
    expect(slugify('Introdução à Programação')).toBe('introducao-a-programacao');
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
  return COURSES.filter(buildCatalogPredicate({ ...EMPTY_FILTERS, ...partial }));
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
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: 'Humanas' })).toBe(true);
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
