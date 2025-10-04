import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, '../../data/commits.db');

export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface CommitTag {
  commit_sha: string;
  tag_id: number;
  created_at: string;
}

/**
 * Initialize tags tables
 */
export const initTagsTables = (db: Database.Database): void => {
  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#58a6ff',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Commit-Tag relationship table
  db.exec(`
    CREATE TABLE IF NOT EXISTS commit_tags (
      commit_sha TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (commit_sha, tag_id),
      FOREIGN KEY (commit_sha) REFERENCES commits(sha) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_commit_tags_sha ON commit_tags(commit_sha);
    CREATE INDEX IF NOT EXISTS idx_commit_tags_tag_id ON commit_tags(tag_id);
  `);

  // Insert default tags if table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };
  if (count.count === 0) {
    const defaultTags = [
      { name: 'feature', color: '#3fb950', description: 'New feature or enhancement' },
      { name: 'bug-fix', color: '#f85149', description: 'Bug fixes' },
      { name: 'refactor', color: '#58a6ff', description: 'Code refactoring' },
      { name: 'docs', color: '#d29922', description: 'Documentation changes' },
      { name: 'test', color: '#8957e5', description: 'Test-related changes' },
      { name: 'chore', color: '#8b949e', description: 'Maintenance and chores' },
    ];

    const stmt = db.prepare('INSERT INTO tags (name, color, description) VALUES (?, ?, ?)');
    for (const tag of defaultTags) {
      stmt.run(tag.name, tag.color, tag.description);
    }
  }
};

/**
 * Get all tags
 */
export const getAllTags = (db: Database.Database): Tag[] => {
  const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
  return stmt.all() as Tag[];
};

/**
 * Create a new tag
 */
export const createTag = (db: Database.Database, name: string, color: string, description?: string): Tag => {
  const stmt = db.prepare('INSERT INTO tags (name, color, description) VALUES (?, ?, ?)');
  const result = stmt.run(name, color, description || null);
  return getTagById(db, result.lastInsertRowid as number)!;
};

/**
 * Get tag by ID
 */
export const getTagById = (db: Database.Database, id: number): Tag | null => {
  const stmt = db.prepare('SELECT * FROM tags WHERE id = ?');
  return stmt.get(id) as Tag | null;
};

/**
 * Update tag
 */
export const updateTag = (db: Database.Database, id: number, name: string, color: string, description?: string): Tag | null => {
  const stmt = db.prepare('UPDATE tags SET name = ?, color = ?, description = ? WHERE id = ?');
  stmt.run(name, color, description || null, id);
  return getTagById(db, id);
};

/**
 * Delete tag
 */
export const deleteTag = (db: Database.Database, id: number): boolean => {
  const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

/**
 * Add tag to commit
 */
export const addTagToCommit = (db: Database.Database, commitSha: string, tagId: number): void => {
  const stmt = db.prepare('INSERT OR IGNORE INTO commit_tags (commit_sha, tag_id) VALUES (?, ?)');
  stmt.run(commitSha, tagId);
};

/**
 * Remove tag from commit
 */
export const removeTagFromCommit = (db: Database.Database, commitSha: string, tagId: number): void => {
  const stmt = db.prepare('DELETE FROM commit_tags WHERE commit_sha = ? AND tag_id = ?');
  stmt.run(commitSha, tagId);
};

/**
 * Get tags for a commit
 */
export const getCommitTags = (db: Database.Database, commitSha: string): Tag[] => {
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN commit_tags ct ON t.id = ct.tag_id
    WHERE ct.commit_sha = ?
    ORDER BY t.name
  `);
  return stmt.all(commitSha) as Tag[];
};

/**
 * Get commits by tag
 */
export const getCommitsByTag = (db: Database.Database, tagId: number, limit = 50, offset = 0): any[] => {
  const stmt = db.prepare(`
    SELECT c.* FROM commits c
    INNER JOIN commit_tags ct ON c.sha = ct.commit_sha
    WHERE ct.tag_id = ?
    ORDER BY c.date DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(tagId, limit, offset);
};

/**
 * Get tag statistics
 */
export const getTagStats = (db: Database.Database): Array<{ tag_id: number; tag_name: string; color: string; count: number }> => {
  const stmt = db.prepare(`
    SELECT
      t.id as tag_id,
      t.name as tag_name,
      t.color,
      COUNT(ct.commit_sha) as count
    FROM tags t
    LEFT JOIN commit_tags ct ON t.id = ct.tag_id
    GROUP BY t.id, t.name, t.color
    ORDER BY count DESC, t.name
  `);
  return stmt.all() as Array<{ tag_id: number; tag_name: string; color: string; count: number }>;
};
