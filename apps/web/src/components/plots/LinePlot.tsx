export interface PlotSeries {
  points: [number, number][];
  color: string;
  label: string;
  dash?: string;
}

export interface LinePlotProps {
  series: PlotSeries[];
  width?: number;
  height?: number;
  xLabel: string;
  yLabel: string;
  logX?: boolean;
  logY?: boolean;
  /** Vertical marker line at this x value (e.g. the probe position). */
  markerX?: number;
}

const MARGIN = { left: 34, right: 8, top: 8, bottom: 24 };

/** Minimal hand-rolled SVG line plot (see docs/architecture.md: no chart lib). */
export function LinePlot({
  series,
  width = 254,
  height = 150,
  xLabel,
  yLabel,
  logX = false,
  logY = false,
  markerX,
}: LinePlotProps) {
  const tx = (v: number): number => (logX ? Math.log10(v) : v);
  const ty = (v: number): number => (logY ? Math.log10(v) : v);

  const xs = series.flatMap((s) => s.points.map((p) => tx(p[0])));
  const ys = series.flatMap((s) => s.points.map((p) => ty(p[1])));
  const finite = (v: number): boolean => Number.isFinite(v);
  const x0 = Math.min(...xs.filter(finite));
  const x1 = Math.max(...xs.filter(finite));
  const y0 = Math.min(...ys.filter(finite));
  const y1 = Math.max(...ys.filter(finite));
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const sx = (v: number): number => MARGIN.left + ((tx(v) - x0) / (x1 - x0 || 1)) * plotW;
  const sy = (v: number): number => MARGIN.top + plotH - ((ty(v) - y0) / (y1 - y0 || 1)) * plotH;

  const fmt = (v: number): string =>
    Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)
      ? v.toExponential(0)
      : `${+v.toPrecision(2)}`;

  return (
    <svg width={width} height={height} style={{ background: '#181818', borderRadius: 4 }}>
      <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="none" stroke="#333" />
      {markerX !== undefined && Number.isFinite(tx(markerX)) && (
        <line
          x1={sx(markerX)}
          y1={MARGIN.top}
          x2={sx(markerX)}
          y2={MARGIN.top + plotH}
          stroke="#888"
          strokeDasharray="3 3"
        />
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.color}
          strokeWidth={1.5}
          strokeDasharray={s.dash}
          points={s.points
            .filter((p) => finite(tx(p[0])) && finite(ty(p[1])))
            .map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`)
            .join(' ')}
        />
      ))}
      <text
        x={MARGIN.left + plotW / 2}
        y={height - 6}
        fill="#999"
        fontSize={10}
        textAnchor="middle"
      >
        {xLabel}
        {logX ? ' (log)' : ''}
      </text>
      <text
        x={10}
        y={MARGIN.top + plotH / 2}
        fill="#999"
        fontSize={10}
        textAnchor="middle"
        transform={`rotate(-90 10 ${MARGIN.top + plotH / 2})`}
      >
        {yLabel}
        {logY ? ' (log)' : ''}
      </text>
      <text x={MARGIN.left} y={height - 12} fill="#666" fontSize={9}>
        {fmt(logX ? 10 ** x0 : x0)}
      </text>
      <text x={MARGIN.left + plotW} y={height - 12} fill="#666" fontSize={9} textAnchor="end">
        {fmt(logX ? 10 ** x1 : x1)}
      </text>
      <text x={MARGIN.left - 2} y={MARGIN.top + 8} fill="#666" fontSize={9} textAnchor="end">
        {fmt(logY ? 10 ** y1 : y1)}
      </text>
      <text x={MARGIN.left - 2} y={MARGIN.top + plotH} fill="#666" fontSize={9} textAnchor="end">
        {fmt(logY ? 10 ** y0 : y0)}
      </text>
    </svg>
  );
}
