export type DonutSlice = {
  label: string;
  value: number;
  color: string;
  sub?: string;
};

type DonutChartProps = {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
};

export function DonutChart({
  slices,
  size = 200,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const radius = (size - 40) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,.06)"
            strokeWidth={20}
          />
          {slices.map((sl, i) => {
            const pct = sl.value / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const circle = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={sl.color}
                strokeWidth={20}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offsetAccum}
              />
            );
            offsetAccum += dash;
            return circle;
          })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <div className="font-display text-2xl text-ivory font-semibold leading-none">
                {centerValue}
              </div>
            )}
            {centerLabel && (
              <div className="font-mono text-[.6rem] uppercase tracking-widest text-ink-dim mt-1">
                {centerLabel}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-2 w-full">
        {slices.map((sl) => (
          <div
            key={sl.label}
            className="flex items-center gap-3 px-2.5 py-1.5 rounded bg-w-4"
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: sl.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[.82rem] text-ivory truncate">
                {sl.label}
              </div>
              {sl.sub && (
                <div className="font-mono text-[.6rem] text-ink-dim truncate">
                  {sl.sub}
                </div>
              )}
            </div>
            <span className="font-mono text-[.78rem] text-gold tabular-nums">
              {((sl.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
