import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a spinner and disable the button while an action is in flight. */
  loading?: boolean;
  /** Stretch to the full width of the container. */
  fullWidth?: boolean;
  children: ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, { padding: string; fontSize: string }> = {
  sm: { padding: '0.375rem 0.75rem', fontSize: '0.85rem' },
  md: { padding: '0.6rem 1.1rem', fontSize: '0.95rem' },
  lg: { padding: '0.8rem 1.4rem', fontSize: '1.05rem' },
};

function variantStyles(variant: ButtonVariant): CSSProperties {
  switch (variant) {
    case 'secondary':
      return {
        background: 'var(--brand-gold)',
        color: 'var(--brand-purple-dark)',
        border: '1px solid var(--brand-gold-dark)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--brand-purple)',
        border: '1px solid var(--color-border)',
      };
    case 'danger':
      return {
        background: 'var(--color-danger)',
        color: '#fff',
        border: '1px solid var(--color-danger)',
      };
    case 'primary':
    default:
      return {
        background: 'var(--brand-purple)',
        color: '#fff',
        border: '1px solid var(--brand-purple)',
      };
  }
}

/** Shared button primitive with variants, sizes, and a loading state. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        ...variantStyles(variant),
        ...SIZE_STYLES[size],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.65 : 1,
        width: fullWidth ? '100%' : undefined,
        transition: 'opacity 0.15s ease, filter 0.15s ease',
        ...style,
      }}
    >
      {loading && (
        <Spinner
          size={16}
          color={
            variant === 'primary' || variant === 'danger'
              ? '#fff'
              : 'var(--brand-purple)'
          }
        />
      )}
      {children}
    </button>
  );
}

export default Button;
