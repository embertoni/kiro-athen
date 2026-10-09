/**
 * Default/empty config factories for each question type.
 *
 * These produce the exact `config` jsonb shapes the SQL grader
 * (grade_answer in 0010_domain_functions.sql) reads. See src/types/domain.ts
 * for the matching TypeScript unions.
 */

import type {
  FillBlankConfig,
  MatchConfig,
  MultipleChoiceConfig,
  SumAlternativesConfig,
} from '@/types/domain';
import type { QuestionType } from '@/types/db';
import { QUESTION_XP } from '@/domain/constants';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  match: 'Associação (pares)',
  multiple_choice: 'Múltipla escolha',
  fill_blank: 'Preencher lacuna',
  sum_alternatives: 'Somatório',
};

let optionCounter = 0;
/** Stable-enough id for a new multiple-choice option within the editor. */
export function newOptionId(): string {
  optionCounter += 1;
  return `opt-${Date.now().toString(36)}-${optionCounter}`;
}

export function emptyConfigFor(type: QuestionType) {
  switch (type) {
    case 'match':
      return { pairs: [{ left: '', right: '' }] } satisfies MatchConfig;
    case 'multiple_choice':
      return {
        options: [
          { id: newOptionId(), text: '', correct: true },
          { id: newOptionId(), text: '', correct: false },
        ],
      } satisfies MultipleChoiceConfig;
    case 'fill_blank':
      return { answers: [''] } satisfies FillBlankConfig;
    case 'sum_alternatives':
      return {
        statements: [
          { value: 1, correct: false },
          { value: 2, correct: false },
          { value: 4, correct: false },
        ],
      } satisfies SumAlternativesConfig;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Default XP for a question type, mirroring the SQL xp_from_question(). */
export function defaultXpFor(type: QuestionType): number {
  return QUESTION_XP[type];
}

/**
 * Validate a question config shape before saving. Returns a human-readable
 * error message in pt-BR, or null when the config is valid.
 */
export function validateQuestionConfig(
  type: QuestionType,
  config: unknown,
): string | null {
  switch (type) {
    case 'match': {
      const c = config as MatchConfig;
      if (!c.pairs?.length) return 'Adicione ao menos um par.';
      if (c.pairs.some((p) => !p.left.trim() || !p.right.trim()))
        return 'Preencha os dois lados de cada par.';
      return null;
    }
    case 'multiple_choice': {
      const c = config as MultipleChoiceConfig;
      if (!c.options?.length || c.options.length < 2)
        return 'Adicione ao menos duas alternativas.';
      if (c.options.some((o) => !o.text.trim()))
        return 'Preencha o texto de todas as alternativas.';
      if (!c.options.some((o) => o.correct))
        return 'Marque ao menos uma alternativa correta.';
      return null;
    }
    case 'fill_blank': {
      const c = config as FillBlankConfig;
      const answers = (c.answers ?? []).filter((a) => a.trim());
      if (answers.length === 0) return 'Informe ao menos uma resposta aceita.';
      return null;
    }
    case 'sum_alternatives': {
      const c = config as SumAlternativesConfig;
      if (!c.statements?.length) return 'Adicione ao menos uma afirmativa.';
      if (!c.statements.some((s) => s.correct))
        return 'Marque ao menos uma afirmativa correta.';
      return null;
    }
    default:
      return null;
  }
}

/**
 * Compute the expected sum for a sum_alternatives config from its correct
 * statements. The server does the same when `expected` is omitted.
 */
export function expectedSum(config: SumAlternativesConfig): number {
  return config.statements
    .filter((s) => s.correct)
    .reduce((acc, s) => acc + s.value, 0);
}
