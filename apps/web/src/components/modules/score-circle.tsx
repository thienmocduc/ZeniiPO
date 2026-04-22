type ScoreCircleProps = {
  percentage: number;
  grade?: string;
  label?: string;
  size?: number;
};

export function ScoreCircle({
  percentage,
  grade,
  label,
  size = 140,
}: ScoreCircleProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage >= 80
      ? '#4ade80'
      : percentage >= 60
        ? '#E4C16E'
        : percentage >= 40
          ? '#fbbf24'
          : '#f87171';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,.08)"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-3xl text-ivory font-semibold leading-none">
            {percentage}
            <em className="not-italic text-ink-2 text-lg">%</em>
          </div>
          {grade && (
            <div className="font-mono text-[.7rem] text-gold mt-1 tracking-widest">
              {grade}
            </div>
          )}
        </div>
      </div>
      {label && (
        <div className="font-mono text-[.65rem] uppercase tracking-widest text-ink-dim">
          {label}
        </div>
      )}
    </div>
  );
}
