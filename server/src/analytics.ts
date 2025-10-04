import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use /app/data in Docker, or relative path in development
const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/commits.db'
  : join(__dirname, '../../data/commits.db');
const db = new Database(dbPath, { readonly: true });

export interface DailyStats {
  date: string;
  commits: number;
  additions: number;
  deletions: number;
  files_changed: number;
}

export interface LanguageStats {
  language: string;
  commits: number;
  additions: number;
  deletions: number;
  percentage: number;
}

export interface HourlyStats {
  hour: number;
  commits: number;
}

export interface TopFile {
  filename: string;
  changes: number;
  commits: number;
}

export interface HeatmapData {
  day: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  commits: number;
}

/**
 * 일별 커밋 통계
 */
export const getDailyStats = (days = 30): DailyStats[] => {
  const stmt = db.prepare(`
    SELECT
      DATE(date) as date,
      COUNT(*) as commits,
      SUM(additions) as additions,
      SUM(deletions) as deletions,
      SUM(files_changed) as files_changed
    FROM commits
    WHERE date >= datetime('now', '-${days} days')
    GROUP BY DATE(date)
    ORDER BY date DESC
  `);
  return stmt.all() as DailyStats[];
};

/**
 * 주별 커밋 통계
 */
export const getWeeklyStats = (weeks = 12): DailyStats[] => {
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-W%W', date) as date,
      COUNT(*) as commits,
      SUM(additions) as additions,
      SUM(deletions) as deletions,
      SUM(files_changed) as files_changed
    FROM commits
    WHERE date >= datetime('now', '-${weeks * 7} days')
    GROUP BY strftime('%Y-W%W', date)
    ORDER BY date DESC
  `);
  return stmt.all() as DailyStats[];
};

/**
 * 월별 커밋 통계
 */
export const getMonthlyStats = (months = 12): DailyStats[] => {
  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as date,
      COUNT(*) as commits,
      SUM(additions) as additions,
      SUM(deletions) as deletions,
      SUM(files_changed) as files_changed
    FROM commits
    WHERE date >= datetime('now', '-${months} months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY date DESC
  `);
  return stmt.all() as DailyStats[];
};

/**
 * 언어별 통계 (파일명 확장자 기반)
 */
export const getLanguageStats = (): LanguageStats[] => {
  const stmt = db.prepare(`
    WITH language_data AS (
      SELECT
        CASE
          WHEN filename LIKE '%.ts' THEN 'TypeScript'
          WHEN filename LIKE '%.tsx' THEN 'TypeScript'
          WHEN filename LIKE '%.js' THEN 'JavaScript'
          WHEN filename LIKE '%.jsx' THEN 'JavaScript'
          WHEN filename LIKE '%.py' THEN 'Python'
          WHEN filename LIKE '%.java' THEN 'Java'
          WHEN filename LIKE '%.go' THEN 'Go'
          WHEN filename LIKE '%.rs' THEN 'Rust'
          WHEN filename LIKE '%.c' THEN 'C'
          WHEN filename LIKE '%.cpp' THEN 'C++'
          WHEN filename LIKE '%.css' THEN 'CSS'
          WHEN filename LIKE '%.html' THEN 'HTML'
          WHEN filename LIKE '%.json' THEN 'JSON'
          WHEN filename LIKE '%.md' THEN 'Markdown'
          ELSE 'Other'
        END as language,
        additions,
        deletions,
        commit_sha
      FROM commit_files
    )
    SELECT
      language,
      COUNT(DISTINCT commit_sha) as commits,
      SUM(additions) as additions,
      SUM(deletions) as deletions,
      ROUND(COUNT(DISTINCT commit_sha) * 100.0 / (SELECT COUNT(DISTINCT commit_sha) FROM language_data), 2) as percentage
    FROM language_data
    WHERE language != 'Other'
    GROUP BY language
    ORDER BY commits DESC
  `);
  return stmt.all() as LanguageStats[];
};

/**
 * 시간대별 커밋 통계 (0-23시)
 */
export const getHourlyStats = (): HourlyStats[] => {
  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(date, 'localtime')) AS INTEGER) as hour,
      COUNT(*) as commits
    FROM commits
    GROUP BY hour
    ORDER BY hour
  `);
  return stmt.all() as HourlyStats[];
};

/**
 * 가장 많이 변경된 파일 TOP N
 */
export const getTopFiles = (limit = 10): TopFile[] => {
  const stmt = db.prepare(`
    SELECT
      filename,
      SUM(changes) as changes,
      COUNT(DISTINCT commit_sha) as commits
    FROM commit_files
    GROUP BY filename
    ORDER BY changes DESC
    LIMIT ?
  `);
  return stmt.all(limit) as TopFile[];
};

/**
 * 작성자별 활동 시간대
 */
export const getAuthorActivityHours = (author: string): HourlyStats[] => {
  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%H', datetime(date, 'localtime')) AS INTEGER) as hour,
      COUNT(*) as commits
    FROM commits
    WHERE author LIKE ?
    GROUP BY hour
    ORDER BY hour
  `);
  return stmt.all(`%${author}%`) as HourlyStats[];
};

/**
 * 히트맵 데이터 (요일별/시간대별 커밋 활동)
 */
export const getHeatmapData = (days = 90): HeatmapData[] => {
  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%w', datetime(date, 'localtime')) AS INTEGER) as day,
      CAST(strftime('%H', datetime(date, 'localtime')) AS INTEGER) as hour,
      COUNT(*) as commits
    FROM commits
    WHERE date >= datetime('now', '-${days} days')
    GROUP BY day, hour
    ORDER BY day, hour
  `);
  return stmt.all() as HeatmapData[];
};

export default db;
