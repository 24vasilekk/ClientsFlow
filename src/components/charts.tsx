type MiniLineChartProps = {
  values: number[];
  labels: string[];
  colorClass?: string;
};

export function MiniLineChart({ values, labels, colorClass = "text-cyan-600" }: MiniLineChartProps) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox="0 0 100 100" className={`h-32 w-full ${colorClass}`} aria-hidden="true">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="mt-2 grid grid-cols-7 text-center text-xs text-slate-500">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

type MiniBarChartProps = {
  values: number[];
};

export function MiniBarChart({ values }: MiniBarChartProps) {
  const max = Math.max(...values);

  return (
    <div className="mt-2 flex h-28 items-end gap-2">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex-1 rounded-t-lg bg-cyan-500/80" style={{ height: `${(value / max) * 100}%` }} />
      ))}
    </div>
  );
}
