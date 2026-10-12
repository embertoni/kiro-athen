interface LogoProps {
  /** Pixel size of the square logo. Defaults to 32. */
  size?: number;
  /** Optional accessible title; set to "" for decorative use. */
  title?: string;
  className?: string;
}

/**
 * Athen brand mark: the official logo PNG (public/athen-logo.png), a swooping
 * purple crescent/hook with a gold circle nested at the lower-right of its
 * opening and a small downward-pointing purple triangle inside the circle.
 * Rendered as a square <img> so it drops in wherever the mark is used (sidebar
 * brand, landing hero). When title === '' the image is decorative.
 */
export function Logo({ size = 32, title = 'Athen', className }: LogoProps) {
  const isDecorative = title === '';
  return (
    <img
      src="/athen-logo.png"
      width={size}
      height={size}
      className={className}
      alt={isDecorative ? '' : title}
      aria-hidden={isDecorative ? true : undefined}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
}

export default Logo;
