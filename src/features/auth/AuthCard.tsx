import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';

interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Links/text rendered under the card (e.g. "já tem conta?"). */
  footer?: ReactNode;
}

/** Centered branded card used by all auth pages. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem 1.25rem',
      }}
    >
      <Link to="/" aria-label="Athen - página inicial">
        <BrandMark size={40} />
      </Link>
      <div
        style={{
          width: '100%',
          maxWidth: '26rem',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--brand-purple)' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          {footer}
        </p>
      )}
    </div>
  );
}

export default AuthCard;
