import { describe, expect, it } from 'vitest';
import type {
  FillBlankConfig,
  MatchConfig,
  MultipleChoiceConfig,
  SumAlternativesConfig,
} from '@/types/domain';
import {
  buildMultipleChoiceSubmitted,
  buildMatchSubmitted,
  expectedSumFor,
  matchCorrectCount,
  previewFillBlankCorrect,
  previewMatchCorrect,
  previewMultipleChoiceCorrect,
  previewSumCorrect,
} from '../answerShaping';

// NOTE: these mirror the SQL grader for optimistic display only. They are NOT
// the authority — finalize_attempt grades for real server-side. The tests here
// assert the client-side answer-shaping/logic, not the SQL grader.

describe('buildMultipleChoiceSubmitted', () => {
  it('de-dupes while preserving order', () => {
    expect(buildMultipleChoiceSubmitted(['a', 'b', 'a', 'c', 'b'])).toEqual({
      selected: ['a', 'b', 'c'],
    });
  });

  it('handles an empty selection', () => {
    expect(buildMultipleChoiceSubmitted([])).toEqual({ selected: [] });
  });
});

describe('previewMultipleChoiceCorrect (exact set, no partial)', () => {
  const config: MultipleChoiceConfig = {
    options: [
      { id: 'a', text: 'A', correct: true },
      { id: 'b', text: 'B', correct: true },
      { id: 'c', text: 'C', correct: false },
    ],
  };

  it('is correct only when the selected set equals the correct set', () => {
    expect(previewMultipleChoiceCorrect(config, ['a', 'b'])).toBe(true);
    expect(previewMultipleChoiceCorrect(config, ['b', 'a'])).toBe(true);
  });

  it('is wrong when an extra option is selected', () => {
    expect(previewMultipleChoiceCorrect(config, ['a', 'b', 'c'])).toBe(false);
  });

  it('is wrong when a correct option is missing', () => {
    expect(previewMultipleChoiceCorrect(config, ['a'])).toBe(false);
  });

  it('supports a single-correct question', () => {
    const single: MultipleChoiceConfig = {
      options: [
        { id: 'x', text: 'X', correct: true },
        { id: 'y', text: 'Y', correct: false },
      ],
    };
    expect(previewMultipleChoiceCorrect(single, ['x'])).toBe(true);
    expect(previewMultipleChoiceCorrect(single, ['y'])).toBe(false);
    expect(previewMultipleChoiceCorrect(single, ['x', 'y'])).toBe(false);
  });
});

describe('sum_alternatives', () => {
  const config: SumAlternativesConfig = {
    statements: [
      { value: 1, correct: true },
      { value: 2, correct: false },
      { value: 4, correct: true },
      { value: 8, correct: false },
    ],
  };

  it('derives the expected sum from the correct statements', () => {
    expect(expectedSumFor(config)).toBe(5);
  });

  it('honors an explicit expected value when present', () => {
    expect(expectedSumFor({ ...config, expected: 99 })).toBe(99);
  });

  it('is correct when the submitted sum equals the expected', () => {
    expect(previewSumCorrect(config, 5)).toBe(true);
    expect(previewSumCorrect(config, 6)).toBe(false);
    expect(previewSumCorrect(config, 0)).toBe(false);
  });
});

describe('fill_blank normalization equivalence', () => {
  const config: FillBlankConfig = { answers: ['São Paulo', 'Sampa'] };

  it('matches regardless of case, accents and surrounding whitespace', () => {
    expect(previewFillBlankCorrect(config, 'sao paulo')).toBe(true);
    expect(previewFillBlankCorrect(config, '  SÃO PAULO  ')).toBe(true);
    expect(previewFillBlankCorrect(config, 'SAMPA')).toBe(true);
  });

  it('collapses internal whitespace', () => {
    expect(previewFillBlankCorrect({ answers: ['a b'] }, 'a   b')).toBe(true);
  });

  it('rejects non-matching or empty answers', () => {
    expect(previewFillBlankCorrect(config, 'rio')).toBe(false);
    expect(previewFillBlankCorrect(config, '   ')).toBe(false);
  });
});

describe('match', () => {
  const config: MatchConfig = {
    pairs: [
      { left: 'FR', right: 'Paris' },
      { left: 'BR', right: 'Brasília' },
    ],
  };

  it('builds a submitted payload preserving pairs', () => {
    expect(buildMatchSubmitted([{ left: 'FR', right: 'Paris' }])).toEqual({
      pairs: [{ left: 'FR', right: 'Paris' }],
    });
  });

  it('is correct only when every pair matches', () => {
    expect(
      previewMatchCorrect(config, [
        { left: 'FR', right: 'Paris' },
        { left: 'BR', right: 'Brasília' },
      ]),
    ).toBe(true);
  });

  it('is wrong when a pair is mismatched or missing', () => {
    expect(
      previewMatchCorrect(config, [
        { left: 'FR', right: 'Brasília' },
        { left: 'BR', right: 'Paris' },
      ]),
    ).toBe(false);
    expect(previewMatchCorrect(config, [{ left: 'FR', right: 'Paris' }])).toBe(
      false,
    );
  });

  it('counts matched pairs for a progress hint', () => {
    expect(
      matchCorrectCount(config, [
        { left: 'FR', right: 'Paris' },
        { left: 'BR', right: 'Paris' },
      ]),
    ).toBe(1);
  });
});
