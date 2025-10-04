import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use /app/data in Docker, or relative path in development
const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/commits.db'
  : path.join(__dirname, '../../data/commits.db');
const db = new Database(dbPath);

export const initCommitsTables = (database: Database.Database): void => {
  // Create commits table
  database.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      sha TEXT PRIMARY KEY,
      full_sha TEXT NOT NULL UNIQUE,
      repo TEXT NOT NULL,
      message TEXT NOT NULL,
      author TEXT NOT NULL,
      author_email TEXT NOT NULL,
      date DATETIME NOT NULL,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      total_changes INTEGER DEFAULT 0,
      files_changed INTEGER DEFAULT 0,
      ai_summary TEXT,
      ai_analyzed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create commit_files table
  database.exec(`
    CREATE TABLE IF NOT EXISTS commit_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commit_sha TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      changes INTEGER DEFAULT 0,
      patch TEXT,
      FOREIGN KEY (commit_sha) REFERENCES commits(full_sha) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo);
    CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
    CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date);
    CREATE INDEX IF NOT EXISTS idx_commit_files_sha ON commit_files(commit_sha);
  `);
};

export interface Commit {
  sha: string;
  full_sha: string;
  repo: string;
  message: string;
  author: string;
  author_email: string;
  date: string;
  additions: number;
  deletions: number;
  total_changes: number;
  files_changed: number;
  ai_summary: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
}

export interface CommitFile {
  id: number;
  commit_sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

export interface CommitStats {
  total_commits: number;
  total_additions: number;
  total_deletions: number;
  total_files_changed: number;
  authors_count: number;
  repos_count: number;
}

export interface CommitFilters {
  search?: string;
  repo?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}

const buildWhereClause = (filters?: CommitFilters): { whereClause: string; params: any[] } => {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (filters?.search) {
    whereClause += ' AND (message LIKE ? OR author LIKE ? OR sha LIKE ?)';
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (filters?.repo && filters.repo !== 'all') {
    whereClause += ' AND repo = ?';
    params.push(filters.repo);
  }

  if (filters?.author && filters.author !== 'all') {
    whereClause += ' AND author = ?';
    params.push(filters.author);
  }

  if (filters?.dateFrom) {
    whereClause += ' AND date >= ?';
    params.push(filters.dateFrom);
  }

  if (filters?.dateTo) {
    whereClause += ' AND date <= ?';
    params.push(filters.dateTo);
  }

  return { whereClause, params };
};

export const getCommits = (limit = 50, offset = 0, filters?: CommitFilters): Commit[] => {
  const { whereClause, params } = buildWhereClause(filters);
  const query = `SELECT * FROM commits ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`;

  const stmt = db.prepare(query);
  return stmt.all(...params, limit, offset) as Commit[];
};

export const getFilteredCount = (filters?: CommitFilters): number => {
  const { whereClause, params } = buildWhereClause(filters);
  const query = `SELECT COUNT(*) as count FROM commits ${whereClause}`;

  const stmt = db.prepare(query);
  const result = stmt.get(...params) as { count: number };
  return result.count;
};

export const getCommitByHash = (sha: string): Commit | undefined => {
  const stmt = db.prepare('SELECT * FROM commits WHERE sha = ? OR full_sha = ?');
  return stmt.get(sha, sha) as Commit | undefined;
};

export const getCommitFiles = (fullSha: string): CommitFile[] => {
  const stmt = db.prepare('SELECT * FROM commit_files WHERE commit_sha = ?');
  return stmt.all(fullSha) as CommitFile[];
};

export const getStats = (): CommitStats => {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_commits,
      SUM(additions) as total_additions,
      SUM(deletions) as total_deletions,
      SUM(files_changed) as total_files_changed,
      COUNT(DISTINCT author) as authors_count,
      COUNT(DISTINCT repo) as repos_count
    FROM commits
  `);
  return stmt.get() as CommitStats;
};

export const getCommitsByRepo = (repo: string, limit = 50): Commit[] => {
  const stmt = db.prepare(`
    SELECT * FROM commits
    WHERE repo = ?
    ORDER BY date DESC
    LIMIT ?
  `);
  return stmt.all(repo, limit) as Commit[];
};

export const getCommitsByAuthor = (author: string, limit = 50): Commit[] => {
  const stmt = db.prepare(`
    SELECT * FROM commits
    WHERE author LIKE ?
    ORDER BY date DESC
    LIMIT ?
  `);
  return stmt.all(`%${author}%`, limit) as Commit[];
};

export const getRepos = (): { repo: string; count: number }[] => {
  const stmt = db.prepare(`
    SELECT repo, COUNT(*) as count
    FROM commits
    GROUP BY repo
    ORDER BY count DESC
  `);
  return stmt.all() as { repo: string; count: number }[];
};

export const getAuthors = (): { author: string; count: number }[] => {
  const stmt = db.prepare(`
    SELECT author, COUNT(*) as count
    FROM commits
    GROUP BY author
    ORDER BY count DESC
  `);
  return stmt.all() as { author: string; count: number }[];
};

export const deleteCommitsByAuthors = (authors: string[]): number => {
  if (authors.length === 0) return 0;

  const placeholders = authors.map(() => '?').join(',');

  // 먼저 해당 커밋들의 SHA를 가져옴
  const getCommitsStmt = db.prepare(`SELECT full_sha FROM commits WHERE author IN (${placeholders})`);
  const commitsToDelete = getCommitsStmt.all(...authors) as { full_sha: string }[];

  if (commitsToDelete.length === 0) return 0;

  // commit_files에서 먼저 삭제 (외래키 제약 때문)
  const shaPlaceholders = commitsToDelete.map(() => '?').join(',');
  const shas = commitsToDelete.map(c => c.full_sha);
  const deleteFilesStmt = db.prepare(`DELETE FROM commit_files WHERE commit_sha IN (${shaPlaceholders})`);
  deleteFilesStmt.run(...shas);

  // commits에서 삭제
  const deleteCommitsStmt = db.prepare(`DELETE FROM commits WHERE author IN (${placeholders})`);
  const result = deleteCommitsStmt.run(...authors);
  return result.changes;
};

export default db;
