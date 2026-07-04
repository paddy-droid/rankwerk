import { useId } from "react";

// Dependency-freies SVG-Linien-Chart fuer Score-Verlaeufe (Domain 0..100).
// Faerbt sich nach dem aktuellsten Score: >=70 gruen, 40-69 amber, <40 rot.

function colorFor(score: number): string {
  return score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
}

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function ScoreSparkline({
  values,
  width = 300,
  height = 64,
  strokeWidth = 2,
  showDots = true,
  showArea = true,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
}) {
  const rawId = useId();
  const gradId = `spark-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const clean = (values ?? []).filter((v) => Number.isFinite(v));
  const n = clean.length;

  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // Leer-Zustand: gestrichelte Grundlinie.
  if (n === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label="Kein Verlauf"
      >
        <line
          x1={padX}
          y1={height / 2}
          x2={width - padX}
          y2={height / 2}
          stroke="rgb(45 53 69)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const pts = clean.map((v, i) => ({
    x: n === 1 ? width / 2 : padX + (i / (n - 1)) * innerW,
    y: padY + (1 - clamp01to100(v) / 100) * innerH,
    v,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const baseline = height - padY;
  const areaPath =
    n >= 2
      ? `${linePath} L ${pts[n - 1].x.toFixed(1)} ${baseline.toFixed(1)} L ${pts[0].x.toFixed(
          1
        )} ${baseline.toFixed(1)} Z`
      : "";

  const lastColor = colorFor(clean[n - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Score-Verlauf: ${clean.join(", ")}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lastColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showArea && n >= 2 && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}

      {n >= 2 && (
        <path
          d={linePath}
          fill="none"
          stroke={lastColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {showDots &&
        pts.map((p, i) => {
          const isLast = i === n - 1;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLast ? 3.4 : 2.3}
              fill={colorFor(p.v)}
              stroke="rgb(8 11 17)"
              strokeWidth={isLast ? 1.5 : 1}
            />
          );
        })}
    </svg>
  );
}
