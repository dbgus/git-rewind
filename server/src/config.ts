import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppConfig {
  github_token: string | null;
  github_username: string | null;
  mistral_api_key: string | null;
  filter_authors: string | null;
  filter_emails: string | null;
  days_back: number | null;
  blacklist_authors: string | null;
  modal_dismissed: boolean;
}

/**
 * Config 테이블 생성 및 초기화
 * .env 파일의 값을 기본값으로 사용
 */
export function initConfigTable(db: Database.Database): void {
  // Config 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // .env에서 값 읽어오기
  const defaults = [
    ["github_token", process.env.GITHUB_TOKEN || ""],
    ["github_username", process.env.GITHUB_USERNAME || ""],
    ["mistral_api_key", process.env.MISTRAL_API_KEY || ""],
    ["filter_authors", process.env.FILTER_AUTHORS || ""],
    ["filter_emails", process.env.FILTER_EMAILS || ""],
    ["days_back", process.env.DAYS_BACK || ""],
    ["blacklist_authors", process.env.BLACKLIST_AUTHORS || ""],
    ["modal_dismissed", "false"],
  ];

  // 기본 설정 삽입 (이미 있으면 무시)
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)
  `);

  db.transaction(() => {
    for (const [key, value] of defaults) {
      insertDefault.run(key, value);
    }
  })();
}

/**
 * 설정 조회
 */
export function getConfig(db: Database.Database): AppConfig {
  const stmt = db.prepare("SELECT key, value FROM config");
  const rows = stmt.all() as { key: string; value: string }[];

  const config: Record<string, string | null> = {};
  for (const row of rows) {
    config[row.key] = row.value || null;
  }

  return {
    github_token: config.github_token || null,
    github_username: config.github_username || null,
    mistral_api_key: config.mistral_api_key || null,
    filter_authors: config.filter_authors || null,
    filter_emails: config.filter_emails || null,
    days_back: config.days_back ? parseInt(config.days_back) : null,
    blacklist_authors: config.blacklist_authors || null,
    modal_dismissed: config.modal_dismissed === "true",
  };
}

/**
 * 설정 업데이트
 */
export function updateConfig(
  db: Database.Database,
  key: string,
  value: string | null
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);
  stmt.run(key, value || "");
}

/**
 * 여러 설정 한번에 업데이트
 */
export function updateConfigs(
  db: Database.Database,
  configs: Partial<Record<keyof AppConfig, string | number | null>>
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  db.transaction(() => {
    for (const [key, value] of Object.entries(configs)) {
      const stringValue = value === null ? "" : String(value);
      stmt.run(key, stringValue);
    }
  })();
}
