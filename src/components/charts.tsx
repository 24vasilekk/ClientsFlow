type MiniLineChartProps = {
  values: number[];
  labels: string[];
  colorClass?: string;
};

export function MiniLineChart({ values, labels, colorClass = "text-cyan-600" }: MiniLineChartProps) {
  if (!values.length) {
    return (
      <div className="studio-chart-shell">
        <div className="flex h-32 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
          Нет данных
        </div>
        <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-slate-500">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    );
  }
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
    <div className="studio-chart-shell chart-animated-shell">
      <svg viewBox="0 0 100 100" className={`mini-line-chart h-32 w-full ${colorClass}`} aria-hidden="true">
        <polyline
          className="mini-line-chart-path"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-slate-500">
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
  if (!values.length) {
    return <div className="studio-chart-shell mt-2 flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-500">Нет данных</div>;
  }
  const max = Math.max(...values);
  const safeMax = max > 0 ? max : 1;

  return (
    <div className="studio-chart-shell chart-animated-shell mt-2 flex h-28 items-end gap-2">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="mini-bar-item flex-1 rounded-t-xl bg-[linear-gradient(180deg,rgba(20,99,255,0.78),rgba(20,99,255,0.52))]"
          style={{
            height: `${(value / safeMax) * 100}%`,
            animationDelay: `${index * 45}ms`
          }}
        />
      ))}
    </div>
  );
}
