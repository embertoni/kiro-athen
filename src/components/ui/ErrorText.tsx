import type { ReactNode } from 'react';

interface ErrorTextProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Inline error banner for form- and page-level error messages. Renders
 * nothing when there is no message.
 */
export function ErrorText({ children, className }: ErrorTextProps) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={className}
      style={{
        margin: 0,
        padding: '0.6rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(214, 69, 69, 0.1)',
        border: '1px solid var(--color-danger)',
        color: 'var(--color-danger)',
        fontSize: '0.88rem',
      }}
    >
      {children}
    </p>
  );
}

export default ErrorText;
