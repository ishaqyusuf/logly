import type { CSSProperties } from "react";

export const brandColor = "#104E32";

// Offset Register: one canonical geometry for the UI and generated app icons.
export const brandMarkPath =
  "M0 0H10V19H17V24H29V30H0Z M13 0H32V16H13V10H26V7H13Z";

export function BrandMark({
  size = 32,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={brandMarkPath} transform="translate(0 1)" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontWeight: 750, letterSpacing: "-0.055em", lineHeight: 1 }}
    >
      logly
    </span>
  );
}

export function BrandAppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: brandColor,
        color: "white",
      }}
    >
      <BrandMark size={size * 0.7} style={{ color: "white" }} />
    </div>
  );
}
