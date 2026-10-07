import { useEffect } from 'react';
import type { ReactNode } from 'react';

type ModalSize = 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Footer actions row (buttons, etc.). */
  footer?: ReactNode;
  /** `lg` is a large overlay used by course details / lesson views. */
  size?: ModalSize;
  /** Close when the backdrop is clicked. Defaults to true. */
  closeOnBackdrop?: boolean;
}

const MAX_WIDTH: Record<ModalSize, string> = {
  md: '32rem',
  lg: '56rem',
};

/**
 * Large overlay popup used across features (course details, lesson runner).
 * Closable via the backdrop, the X button, or the Escape key. Locks body
 * scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 26, 40, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          maxWidth: MAX_WIDTH[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--brand-purple)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.4rem',
              lineHeight: 1,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            &times;
          </button>
        </header>
        <div style={{ padding: '1.25rem', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <footer
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export default Modal;
