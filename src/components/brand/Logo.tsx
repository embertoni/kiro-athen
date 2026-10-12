interface LogoProps {
  /** Pixel size of the square logo. Defaults to 32. */
  size?: number;
  /** Optional accessible title; set to "" for decorative use. */
  title?: string;
  className?: string;
}

/**
 * Athen brand mark rendered inline as SVG: a bold purple crescent moon
 * (#5B2A86) opening toward the lower-right, a gold circle (#FFC107) nested in
 * the opening with a thin background-colored gap so the two shapes read as
 * distinct, and a small downward-pointing purple triangle in the upper-right
 * quadrant. Kept visually identical to public/athen-logo.svg (the favicon).
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
      {/* Purple crescent: outer disc with an offset disc carved out. */}
      <path
        fill="#5B2A86"
        fillRule="evenodd"
        d="M32 2a30 30 0 1 0 0 60 30 30 0 0 1 0-60zM41 10a24.5 24.5 0 1 1 0 44 29.5 29.5 0 0 0 0-44z"
      />
      {/* Thin background-colored gap ring between crescent and gold circle. */}
      <circle cx="41" cy="34" r="17.5" fill="#ffffff" />
      {/* Gold/yellow circle nested in the crescent's opening. */}
      <circle cx="41" cy="34" r="15.5" fill="#FFC107" />
      {/* Small downward-pointing purple triangle (upper-right quadrant). */}
      <path fill="#5B2A86" d="M40 24h11l-5.5 10z" />
    </svg>
  );
}

export default Logo;
