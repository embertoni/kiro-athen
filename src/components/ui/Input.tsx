import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible field label. */
  label?: string;
  /** Error message shown below the field; also sets aria-invalid. */
  error?: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
}

/** Shared labelled text input with error/hint display. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, style, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedById = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}
        >
          {label}
        </label>
      )}
      <input
        {...rest}
        id={inputId}
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
      />
      {error ? (
        <span
          id={`${inputId}-error`}
          style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}
        >
          {error}
        </span>
      ) : hint ? (
        <span
          id={`${inputId}-hint`}
          style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
});

export default Input;
