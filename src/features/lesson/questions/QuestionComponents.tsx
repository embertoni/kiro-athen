/**
 * Per-type answer input components for the lesson runner.
 *
 * Each component renders the question UI from its `config` and reports the raw
 * `submitted` payload up to the LessonView via onChange. These components do NOT
 * grade anything: grading and XP are computed server-side by finalize_attempt.
 * The only client-side "grading" is a non-authoritative preview shown AFTER the
 * server has finalized (clearly labelled), driven by answerShaping helpers.
 */

import { useMemo } from 'react';
import type {
  FillBlankConfig,
  FillBlankSubmitted,
  MatchConfig,
  MatchSubmitted,
  MultipleChoiceConfig,
  MultipleChoiceSubmitted,
  SumAlternativesConfig,
  SumAlternativesSubmitted,
} from '@/types/domain';
import {
  buildMatchSubmitted,
  buildMultipleChoiceSubmitted,
  expectedSumFor,
} from '../answerShaping';

const fieldStyle: React.CSSProperties = {
  padding: '0.5rem 0.65rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
};

interface AnswerProps<TConfig, TSubmitted> {
  config: TConfig;
  value: TSubmitted | null;
  onChange: (next: TSubmitted) => void;
  /** When true the inputs are read-only (attempt finalized). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// multiple_choice (single or multi correct; the user may pick any number)
// ---------------------------------------------------------------------------

export function MultipleChoiceQuestion({
  config,
  value,
  onChange,
  disabled,
}: AnswerProps<MultipleChoiceConfig, MultipleChoiceSubmitted>) {
  const selected = value?.selected ?? [];
  // More than one correct option => allow multi-select (checkboxes).
  const multi = useMemo(
    () => config.options.filter((o) => o.correct).length > 1,
    [config.options],
  );

  function toggle(optionId: string) {
    if (disabled) return;
    if (multi) {
      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
      onChange(buildMultipleChoiceSubmitted(next));
    } else {
      onChange(buildMultipleChoiceSubmitted([optionId]));
    }
  }

  return (
    <div role="group" style={{ display: 'grid', gap: '0.4rem' }}>
      {config.options.map((opt) => {
        const checked = selected.includes(opt.id);
        return (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.45rem 0.6rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${checked ? 'var(--brand-purple)' : 'var(--color-border)'}`,
              background: checked ? 'rgba(91, 42, 134, 0.06)' : 'transparent',
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={`mc-${opt.id}`}
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(opt.id)}
            />
            <span>{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// fill_blank (free text; the server normalizes and compares)
// ---------------------------------------------------------------------------

export function FillBlankQuestion({
  value,
  onChange,
  disabled,
}: AnswerProps<FillBlankConfig, FillBlankSubmitted>) {
  return (
    <input
      type="text"
      value={value?.text ?? ''}
      disabled={disabled}
      placeholder="Digite sua resposta..."
      onChange={(e) => onChange({ text: e.target.value })}
      style={{ ...fieldStyle, width: '100%' }}
    />
  );
}

// ---------------------------------------------------------------------------
// sum_alternatives (pick statements; the submitted value is the numeric sum)
// ---------------------------------------------------------------------------

export function SumAlternativesQuestion({
  config,
  value,
  onChange,
  disabled,
}: AnswerProps<SumAlternativesConfig, SumAlternativesSubmitted>) {
  // Track selected statement indexes locally through the submitted sum: we
  // reconstruct selection by matching values is ambiguous, so we keep a derived
  // checked map by index using a parallel selection carried in the sum only.
  // To keep selection stable we store selected indexes in a WeakMap-free way:
  // the LessonView passes back the submitted sum; selection UI toggles values.
  const selectedValues = value ? decodeSelectedValues(config, value.sum) : [];

  function toggle(index: number) {
    if (disabled) return;
    const set = new Set(selectedValues);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    const sum = [...set].reduce((acc, i) => acc + config.statements[i].value, 0);
    onChange({ sum });
  }

  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      {config.statements.map((st, index) => {
        const checked = selectedValues.includes(index);
        return (
          <label
            key={index}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.45rem 0.6rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${checked ? 'var(--brand-purple)' : 'var(--color-border)'}`,
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(index)}
            />
            <strong style={{ minWidth: '2.5rem' }}>{st.value.toString().padStart(2, '0')}</strong>
          </label>
        );
      })}
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        Soma atual: <strong>{value?.sum ?? 0}</strong>
      </p>
    </div>
  );
}

/**
 * Reconstruct which statement indexes are selected from a submitted sum. We
 * select the unique subset greedily by descending value; since sum_alternatives
 * values are distinct powers/unique integers in practice this is stable for the
 * editor's generated configs. This is display-only reconstruction.
 */
function decodeSelectedValues(
  config: SumAlternativesConfig,
  sum: number,
): number[] {
  const indexed = config.statements
    .map((s, i) => ({ i, value: s.value }))
    .sort((a, b) => b.value - a.value);
  let remaining = sum;
  const picked: number[] = [];
  for (const { i, value } of indexed) {
    if (value <= remaining) {
      picked.push(i);
      remaining -= value;
    }
  }
  return remaining === 0 ? picked : [];
}

// ---------------------------------------------------------------------------
// match (associate each left item with a right item via selects)
// ---------------------------------------------------------------------------

export function MatchQuestion({
  config,
  value,
  onChange,
  disabled,
}: AnswerProps<MatchConfig, MatchSubmitted>) {
  // Shuffle-free right options; the user chooses the right value for each left.
  const rightOptions = useMemo(
    () => config.pairs.map((p) => p.right),
    [config.pairs],
  );
  const current = new Map((value?.pairs ?? []).map((p) => [p.left, p.right]));

  function setRight(left: string, right: string) {
    if (disabled) return;
    const next = config.pairs.map((p) => ({
      left: p.left,
      right: left === p.left ? right : (current.get(p.left) ?? ''),
    }));
    onChange(buildMatchSubmitted(next.filter((p) => p.right !== '')));
  }

  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      {config.pairs.map((p) => (
        <div
          key={p.left}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        >
          <span style={{ flex: 1 }}>{p.left}</span>
          <select
            value={current.get(p.left) ?? ''}
            disabled={disabled}
            onChange={(e) => setRight(p.left, e.target.value)}
            style={{ ...fieldStyle, flex: 1 }}
          >
            <option value="">Selecione...</option>
            {rightOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export { expectedSumFor };
