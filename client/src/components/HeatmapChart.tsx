interface HeatmapData {
  day: number;
  hour: number;
  commits: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const HeatmapChart = ({ data }: HeatmapChartProps) => {
  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  data.forEach(item => {
    const key = `${item.day}-${item.hour}`;
    dataMap.set(key, item.commits);
  });

  // Find max commits for color scaling
  const maxCommits = Math.max(...data.map(d => d.commits), 1);

  // Get color based on commit count
  const getColor = (commits: number): string => {
    if (commits === 0) return 'var(--color-bg-tertiary)';
    const intensity = commits / maxCommits;
    if (intensity > 0.75) return 'var(--color-success)';
    if (intensity > 0.5) return '#58a6ff';
    if (intensity > 0.25) return '#79c0ff';
    return '#a5d6ff';
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hours header */}
        <div className="flex">
          <div className="w-12 flex-shrink-0" /> {/* Space for day labels */}
          <div className="flex gap-px">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="w-6 text-center text-xs text-[var(--color-text-muted)]"
              >
                {hour % 4 === 0 ? hour : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap grid */}
        <div className="mt-1">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex mb-px">
              {/* Day label */}
              <div className="w-12 flex-shrink-0 text-xs text-[var(--color-text-secondary)] pr-2 text-right leading-6">
                {day}
              </div>

              {/* Hour cells */}
              <div className="flex gap-px">
                {HOURS.map(hour => {
                  const key = `${dayIndex}-${hour}`;
                  const commits = dataMap.get(key) || 0;
                  const color = getColor(commits);

                  return (
                    <div
                      key={hour}
                      className="group relative w-6 h-6 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-[var(--color-accent-primary)] hover:z-10"
                      style={{ backgroundColor: color }}
                      title={`${day} ${hour}:00 - ${commits} commits`}
                    >
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-xs whitespace-nowrap z-20 shadow-lg">
                        <div className="font-semibold">{day} {hour}:00</div>
                        <div className="text-[var(--color-text-secondary)]">{commits} commits</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                          <div className="border-4 border-transparent border-t-[var(--color-border)]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-[var(--color-text-secondary)]">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#a5d6ff' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#79c0ff' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#58a6ff' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'var(--color-success)' }} />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
