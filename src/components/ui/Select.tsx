import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
}

/** Shared labelled select with error/hint display. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, hint, options, id, style, ...rest }, ref) {
    const autoId = useId();
    const selectId = id ?? autoId;
    const describedById = error
      ? `${selectId}-error`
      : hint
        ? `${selectId}-hint`
        : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            {label}
          </label>
        )}
        <select
          {...rest}
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: '0.95rem',
            outline: 'none',
            ...style,
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <span
            id={`${selectId}-error`}
            style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}
          >
            {error}
          </span>
        ) : hint ? (
          <span
            id={`${selectId}-hint`}
            style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}
          >
            {hint}
          </span>
        ) : null}
      </div>
    );
  },
);

export default Select;
