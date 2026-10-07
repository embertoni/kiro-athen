interface SpinnerProps {
  /** Diameter in pixels. Defaults to 20. */
  size?: number;
  /** Stroke color. Defaults to the brand purple. */
  color?: string;
  /** Accessible label. Defaults to "Carregando". */
  label?: string;
  className?: string;
}

/**
 * Lightweight loading spinner used across features (buttons, page loaders).
 * Pure CSS animation injected once via a <style> tag.
 */
export function Spinner({
  size = 20,
  color = 'var(--brand-purple)',
  label = 'Carregando',
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={className}
      style={{ display: 'inline-flex', lineHeight: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ animation: 'athen-spin 0.7s linear infinite' }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <style>{'@keyframes athen-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}

export default Spinner;
