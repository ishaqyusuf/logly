/** A tiny bar trend of an event's volume across the selected range. */
export function CatalogSparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const max = Math.max(0, ...values);
  const width = 72;
  const height = 20;
  const gap = values.length > 20 ? 0.5 : 1;
  const bar = values.length
    ? (width - gap * (values.length - 1)) / values.length
    : 0;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${values.join(", ")}`}
      className="shrink-0"
    >
      {values.map((value, index) => {
        const h = max ? Math.max(value ? 2 : 1, (value / max) * height) : 1;
        return (
          <rect
            key={index}
            x={index * (bar + gap)}
            y={height - h}
            width={bar}
            height={h}
            rx={0.5}
            className={value ? "fill-[#9cc2aa]" : "fill-[#ece8e0]"}
          />
        );
      })}
    </svg>
  );
}
