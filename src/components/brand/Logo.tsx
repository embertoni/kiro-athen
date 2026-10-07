interface LogoProps {
  /** Pixel size of the square logo. Defaults to 32. */
  size?: number;
  /** Optional accessible title; set to "" for decorative use. */
  title?: string;
  className?: string;
}

/**
 * Athen brand mark rendered inline as SVG: a purple crescent moon (#5B2A86)
 * wrapping a gold circle (#FFC107) that contains a small downward-pointing
 * purple triangle. Mirrors public/athen-logo.svg (the favicon).
 */
export function Logo({ size = 32, title = 'Athen', className }: LogoProps) {
  const isDecorative = title === '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative ? true : undefined}
      aria-label={isDecorative ? undefined : title}
    >
      {!isDecorative && <title>{title}</title>}
      <path fill="#5B2A86" d="M32 2a30 30 0 1 0 0 60 30 30 0 0 1 0-60z" />
      <circle cx="38" cy="32" r="17" fill="#FFC107" />
      <path fill="#5B2A86" d="M31 25h14l-7 12z" />
    </svg>
  );
}

export default Logo;
