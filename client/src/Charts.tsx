import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartCardSkeleton } from './components/Skeleton';
import { HeatmapChart } from './components/HeatmapChart';
import {
  fetchDailyStats,
  fetchWeeklyStats,
  fetchMonthlyStats,
  fetchLanguageStats,
  fetchHourlyStats,
  fetchTopFiles,
  fetchRepos,
  fetchAuthors,
  fetchHeatmapData,
  type DailyStats,
  type LanguageStats,
  type HourlyStats,
  type TopFile,
  type HeatmapData,
} from './api';

const COLORS = ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#8957e5', '#da3633', '#6e7681'];

type TimeRange = 'daily' | 'weekly' | 'monthly';

function Charts() {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [languageStats, setLanguageStats] = useState<LanguageStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [repoStats, setRepoStats] = useState<{ repo: string; count: number }[]>([]);
  const [authorStats, setAuthorStats] = useState<{ author: string; count: number }[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTimeRangeData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [daily, languages, hourly, files, repos, authors, heatmap] = await Promise.all([
        fetchDailyStats(30),
        fetchLanguageStats(),
        fetchHourlyStats(),
        fetchTopFiles(10),
        fetchRepos(),
        fetchAuthors(),
        fetchHeatmapData(90),
      ]);
      setDailyStats(daily.reverse()); // 오래된 날짜부터
      setLanguageStats(languages);
      setHourlyStats(hourly);
      setTopFiles(files);
      setRepoStats(repos.slice(0, 10));
      setAuthorStats(authors.slice(0, 10));
      setHeatmapData(heatmap);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeRangeData = async () => {
    try {
      let data: DailyStats[];
      switch (timeRange) {
        case 'daily':
          data = await fetchDailyStats(30);
          break;
        case 'weekly':
          data = await fetchWeeklyStats(12);
          break;
        case 'monthly':
          data = await fetchMonthlyStats(12);
          break;
      }
      setDailyStats(data.reverse());
    } catch (error) {
      console.error('Failed to load time range data:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold">📊 Analytics Dashboard</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[...Array(7)].map((_, i) => (
            <ChartCardSkeleton key={i} />
          ))}
          {/* Last chart spans 2 columns */}
          <div className="lg:col-span-2">
            <ChartCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'daily':
        return 'Last 30 Days';
      case 'weekly':
        return 'Last 12 Weeks';
      case 'monthly':
        return 'Last 12 Months';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold">📊 Analytics Dashboard</h2>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1 gap-1">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeRange === 'daily'
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            onClick={() => setTimeRange('daily')}
          >
            Daily
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeRange === 'weekly'
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            onClick={() => setTimeRange('weekly')}
          >
            Weekly
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeRange === 'monthly'
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            onClick={() => setTimeRange('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Commits Over Time Chart */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Commits ({getTimeRangeLabel()})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="date" stroke="#8b949e" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="commits"
                stroke="#58a6ff"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Language Distribution */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Language Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={languageStats}
                dataKey="commits"
                nameKey="language"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ language, percentage }) => `${language} ${percentage}%`}
              >
                {languageStats.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Activity */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Activity by Hour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="hour" stroke="#8b949e" />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="commits" fill="#3fb950" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Changed Files */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Top 10 Changed Files</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFiles} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis type="number" stroke="#8b949e" />
              <YAxis
                type="category"
                dataKey="filename"
                stroke="#8b949e"
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="changes" fill="#d29922" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Repository Distribution */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Repository Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={repoStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis type="number" stroke="#8b949e" />
              <YAxis
                type="category"
                dataKey="repo"
                stroke="#8b949e"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="count" fill="#8957e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Author Contributions */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Top Contributors</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={authorStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="author" stroke="#8b949e" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="count" fill="#58a6ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Code Changes Over Time */}
        <div className="lg:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Code Changes (Additions vs Deletions)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="date" stroke="#8b949e" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8b949e" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="additions"
                stroke="#3fb950"
                strokeWidth={2}
                name="Additions"
              />
              <Line
                type="monotone"
                dataKey="deletions"
                stroke="#f85149"
                strokeWidth={2}
                name="Deletions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Heatmap */}
        <div className="lg:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">📅 Activity Heatmap (Last 90 Days)</h3>
          <div className="text-sm text-[var(--color-text-secondary)] mb-4">
            Commit activity by day of week and hour of day
          </div>
          <HeatmapChart data={heatmapData} />
        </div>
      </div>
    </div>
  );
}

export default Charts;
