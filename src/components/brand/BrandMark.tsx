import { Logo } from './Logo';

interface BrandMarkProps {
  /** Logo size in pixels. Defaults to 32. */
  size?: number;
  /** Hide the "Athen" wordmark and render only the logo. */
  hideWordmark?: boolean;
  className?: string;
}

/** The Athen logo paired with the "Athen" wordmark. */
export function BrandMark({ size = 32, hideWordmark = false, className }: BrandMarkProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <Logo size={size} title={hideWordmark ? 'Athen' : ''} />
      {!hideWordmark && (
        <span
          style={{
            fontWeight: 700,
            fontSize: `${size * 0.6}px`,
            color: 'var(--brand-purple)',
            letterSpacing: '0.01em',
          }}
        >
          Athen
        </span>
      )}
    </span>
  );
}

export default BrandMark;
