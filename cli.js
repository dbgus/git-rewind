import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { Mistral } from "@mistralai/mistralai";

dotenv.config();

class GitHubCommitFetcher {
  constructor(token, db, mistralClient) {
    this.octokit = new Octokit({ auth: token });
    this.db = db;
    this.mistral = mistralClient;
  }

  /**
   * 특정 레포의 커밋 목록 가져오기
   * @param {string[]} filterAuthors - 필터링할 작성자 이름 목록
   * @param {string[]} filterEmails - 필터링할 이메일 목록
   */
  async getCommits(owner, repo, filterAuthors, filterEmails, since) {
    try {
      console.log(`📦 Fetching commits from ${owner}/${repo}...`);

      const allCommits = [];
      let page = 1;
      let hasMore = true;

      // 페이지네이션으로 모든 커밋 가져오기
      while (hasMore) {
        const params = {
          owner,
          repo,
          since: since?.toISOString(),
          per_page: 100,
          page,
        };

        // GitHub API는 author 파라미터로 한 명만 필터링 가능
        // 여러 명을 필터링하려면 전체를 가져온 후 클라이언트에서 필터링
        const { data } = await this.octokit.repos.listCommits(params);

        if (data.length === 0) {
          hasMore = false;
        } else {
          allCommits.push(...data);
          console.log(
            `   Page ${page}: ${data.length} commits collected (total: ${allCommits.length})`
          );

          // 100개 미만이면 마지막 페이지
          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
            // API Rate Limit 고려하여 약간의 딜레이
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }

      // 작성자 필터가 있으면 클라이언트 사이드에서 필터링
      let filteredData = allCommits;
      const hasFilters =
        (filterAuthors && filterAuthors.length > 0) ||
        (filterEmails && filterEmails.length > 0);

      if (hasFilters) {
        filteredData = allCommits.filter((commit) => {
          const authorName = commit.commit.author.name;
          const authorEmail = commit.commit.author.email;
          const authorLogin = commit.author?.login;

          // 이름 또는 이메일 중 하나라도 매치되면 포함
          const nameMatch =
            !filterAuthors ||
            filterAuthors.length === 0 ||
            filterAuthors.some(
              (author) =>
                authorName?.toLowerCase().includes(author.toLowerCase()) ||
                authorLogin?.toLowerCase().includes(author.toLowerCase())
            );

          const emailMatch =
            !filterEmails ||
            filterEmails.length === 0 ||
            filterEmails.some((email) =>
              authorEmail?.toLowerCase().includes(email.toLowerCase())
            );

          // 이름 필터와 이메일 필터가 모두 있으면 둘 다 만족해야 함
          if (
            filterAuthors &&
            filterAuthors.length > 0 &&
            filterEmails &&
            filterEmails.length > 0
          ) {
            return nameMatch && emailMatch;
          }
          // 하나만 있으면 그것만 만족하면 됨
          return nameMatch || emailMatch;
        });
        console.log(
          `   (${filteredData.length} of ${allCommits.length} match filter criteria)`
        );
      }

      console.log(`✅ Found ${filteredData.length} commits.`);
      return filteredData;
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      return [];
    }
  }

  /**
   * 커밋의 상세 정보 가져오기 (파일 변경 내역 포함)
   */
  async getCommitDetails(owner, repo, sha) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        sha: data.sha.substring(0, 7),
        message: data.commit.message,
        author: data.commit.author.name,
        date: data.commit.author.date,
        additions: data.stats.additions,
        deletions: data.stats.deletions,
        totalChanges: data.stats.total,
        filesChanged: data.files.length,
        files: data.files.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
        })),
      };
    } catch (error) {
      console.error(`❌ Failed to fetch commit details: ${error.message}`);
      return null;
    }
  }

  /**
   * 커밋의 코드 변경 사항(diff) 가져오기
   */
  async getCommitDiff(owner, repo, sha) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
        mediaType: {
          format: "diff", // diff 형식으로 요청
        },
      });

      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch diff: ${error.message}`);
      return null;
    }
  }

  /**
   * 커밋의 상세 정보 + 코드 변경 사항 함께 가져오기
   */
  async getCommitDetailsWithDiff(owner, repo, sha) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        sha: data.sha.substring(0, 7),
        fullSha: data.sha,
        message: data.commit.message,
        author: data.commit.author.name,
        authorEmail: data.commit.author.email,
        date: data.commit.author.date,
        additions: data.stats.additions,
        deletions: data.stats.deletions,
        totalChanges: data.stats.total,
        filesChanged: data.files.length,
        files: data.files.map((f) => ({
          filename: f.filename,
          status: f.status, // added, modified, removed, renamed
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch, // 실제 코드 변경 사항 (diff)
        })),
      };
    } catch (error) {
      console.error(`❌ Failed to fetch commit details+diff: ${error.message}`);
      return null;
    }
  }

  /**
   * 사용자의 모든 레포지토리 목록 가져오기 (Private 포함)
   */
  async getUserRepos(username) {
    try {
      console.log(`\n👤 Fetching ${username}'s repositories...`);

      // 인증된 사용자의 레포 가져오기 (private 포함)
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: "updated",
        affiliation: "owner,collaborator", // 소유자 + 협업자 레포
      });

      const repos = data.map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        language: repo.language,
        updatedAt: repo.updated_at,
      }));

      console.log(`✅ Found ${repos.length} repositories.`);
      console.log(`   - Public: ${repos.filter((r) => !r.private).length}`);
      console.log(`   - Private: ${repos.filter((r) => r.private).length}\n`);

      return repos;
    } catch (error) {
      console.error(`❌ Failed to fetch repository list: ${error.message}`);
      return [];
    }
  }

  /**
   * Rate Limit 확인
   */
  async checkRateLimit() {
    const { data } = await this.octokit.rateLimit.get();
    const remaining = data.rate.remaining;
    const limit = data.rate.limit;
    const resetDate = new Date(data.rate.reset * 1000);

    console.log(`\n⏱️  API Rate Limit: ${remaining}/${limit}`);
    console.log(`   Reset time: ${resetDate.toLocaleString()}\n`);

    return { remaining, limit, resetDate };
  }

  /**
   * SHA로 커밋이 DB에 존재하는지 확인
   */
  getCommitFromDB(fullSha) {
    try {
      const commit = this.db
        .prepare(
          `
        SELECT ai_summary FROM commits WHERE full_sha = ?
      `
        )
        .get(fullSha);

      return commit || null;
    } catch (error) {
      console.error(`❌ Failed to query database: ${error.message}`);
      return null;
    }
  }

  /**
   * Mistral AI로 커밋 분석
   */
  async analyzeCommitWithAI(commitData) {
    if (!this.mistral) {
      return null;
    }

    try {
      // 커밋 정보를 간결하게 정리
      const filesInfo = commitData.files
        .map(
          (f) =>
            `- ${f.filename} (${f.status}): +${f.additions}/-${f.deletions}`
        )
        .join("\n");

      const prompt = `다음 Git 커밋을 분석하고 어떤 작업을 했는지 한국어로 간단히 요약해주세요 (2-3문장):

커밋 메시지: ${commitData.message}

변경된 파일:
${filesInfo}

통계: +${commitData.additions}/-${commitData.deletions} (${commitData.filesChanged}개 파일)`;

      const response = await this.mistral.chat.complete({
        model: "mistral-small-latest",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const summary = response.choices[0].message.content.trim();
      return summary;
    } catch (error) {
      console.error(`   ⚠️  AI analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * 커밋 정보를 데이터베이스에 저장
   */
  saveCommitToDB(commitData, aiSummary = null) {
    const insertCommit = this.db.prepare(`
      INSERT OR REPLACE INTO commits (
        sha, full_sha, repo, message, author, author_email, date,
        additions, deletions, total_changes, files_changed, ai_summary, ai_analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFile = this.db.prepare(`
      INSERT OR REPLACE INTO commit_files (
        commit_sha, filename, status, additions, deletions, changes, patch
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      // 트랜잭션으로 묶어서 처리
      this.db.transaction(() => {
        // 커밋 정보 저장
        insertCommit.run(
          commitData.sha,
          commitData.fullSha,
          commitData.repo,
          commitData.message,
          commitData.author,
          commitData.authorEmail,
          commitData.date,
          commitData.additions,
          commitData.deletions,
          commitData.totalChanges,
          commitData.filesChanged,
          aiSummary,
          aiSummary ? new Date().toISOString() : null
        );

        // 파일 변경 내역 저장
        for (const file of commitData.files) {
          insertFile.run(
            commitData.fullSha,
            file.filename,
            file.status,
            file.additions,
            file.deletions,
            file.changes,
            file.patch || null
          );
        }
      })();

      return true;
    } catch (error) {
      console.error(`❌ Failed to save to database: ${error.message}`);
      return false;
    }
  }
}

/**
 * 데이터베이스 초기화
 */
function initDatabase() {
  const dataDir = "./data";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  const db = new Database("./data/commits.db");

  // Foreign key 활성화
  db.pragma("foreign_keys = ON");

  // 커밋 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      sha TEXT PRIMARY KEY,
      full_sha TEXT NOT NULL UNIQUE,
      repo TEXT NOT NULL,
      message TEXT NOT NULL,
      author TEXT NOT NULL,
      author_email TEXT,
      date TEXT NOT NULL,
      additions INTEGER NOT NULL,
      deletions INTEGER NOT NULL,
      total_changes INTEGER NOT NULL,
      files_changed INTEGER NOT NULL,
      ai_summary TEXT,
      ai_analyzed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 파일 변경 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS commit_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commit_sha TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT,
      additions INTEGER NOT NULL,
      deletions INTEGER NOT NULL,
      changes INTEGER NOT NULL,
      patch TEXT,
      FOREIGN KEY (commit_sha) REFERENCES commits(full_sha),
      UNIQUE(commit_sha, filename)
    )
  `);

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo);
    CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
    CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date);
    CREATE INDEX IF NOT EXISTS idx_commit_files_sha ON commit_files(commit_sha);
  `);

  console.log("📦 Database initialization complete\n");
  return db;
}

// 메인 실행 함수
async function main() {
  console.log("🚀 GitHub Commit Fetcher starting\n");

  // 데이터베이스 초기화
  const db = initDatabase();

  // Config에서 설정 로드
  const getConfig = db.prepare("SELECT key, value FROM config").all();
  const config = {};
  for (const row of getConfig) {
    config[row.key] = row.value || null;
  }

  const token = config.github_token;
  const username = config.github_username;
  const mistralApiKey = config.mistral_api_key;
  const filterAuthorsInput = config.filter_authors;
  const filterEmailsInput = config.filter_emails;
  const blacklistAuthorsInput = config.blacklist_authors;
  const daysBack = config.days_back ? parseInt(config.days_back) : null;

  // REPOS는 환경변수에서만 (CLI 전용)
  const reposInput = process.env.REPOS;

  if (!token) {
    console.error("❌ GitHub token is not configured.");
    console.log("   Please set github_token in DB config table.");
    console.log(
      "   Or set GITHUB_TOKEN in .env file and restart the server.\n"
    );
    return;
  }

  // Mistral AI 클라이언트 초기화 (선택적)
  let mistralClient = null;
  if (mistralApiKey) {
    mistralClient = new Mistral({ apiKey: mistralApiKey });
    console.log("🤖 Mistral AI analysis enabled\n");
  } else {
    console.log("ℹ️  Mistral AI disabled (no MISTRAL_API_KEY)\n");
  }

  const fetcher = new GitHubCommitFetcher(token, db, mistralClient);

  // 필터링할 작성자 목록 파싱
  const filterAuthors = filterAuthorsInput
    ? filterAuthorsInput
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a)
    : [];

  const filterEmails = filterEmailsInput
    ? filterEmailsInput
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e)
    : [];

  const blacklistAuthors = blacklistAuthorsInput
    ? blacklistAuthorsInput
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a)
    : [];

  if (filterAuthors.length > 0 || filterEmails.length > 0) {
    console.log(`🔍 Filter settings:`);
    if (filterAuthors.length > 0) {
      console.log(`   Authors: ${filterAuthors.join(", ")}`);
    }
    if (filterEmails.length > 0) {
      console.log(`   Emails: ${filterEmails.join(", ")}`);
    }
    console.log("");
  } else {
    console.log(`🔍 Filter: None (fetch all commits)\n`);
  }

  if (blacklistAuthors.length > 0) {
    console.log(`🚫 Blacklisted authors: ${blacklistAuthors.join(", ")}\n`);
  }

  // Rate Limit 확인
  await fetcher.checkRateLimit();

  // 조회 기간 설정
  let since = null;
  if (daysBack) {
    since = new Date();
    since.setDate(since.getDate() - daysBack);
    console.log(`📅 Date range: ${since.toLocaleDateString()} ~ today\n`);
  } else {
    console.log(`📅 Date range: all commit history\n`);
  }

  let repos = [];

  // REPOS가 설정되어 있으면 해당 레포만, 아니면 사용자의 모든 레포
  if (reposInput) {
    repos = reposInput.split(",").map((r) => {
      const [owner, name] = r.trim().split("/");
      return { owner, name };
    });
  } else if (username) {
    const userRepos = await fetcher.getUserRepos(username);
    repos = userRepos.map((r) => {
      const [owner, name] = r.fullName.split("/");
      return { owner, name, ...r };
    });
  } else {
    console.error("❌ Please set REPOS or GITHUB_USERNAME.");
    return;
  }

  console.log(`📋 Fetching commits from ${repos.length} repositories.\n`);

  const allResults = [];

  // 각 레포별로 커밋 가져오기
  for (const repo of repos) {
    const commits = await fetcher.getCommits(
      repo.owner,
      repo.name,
      filterAuthors,
      filterEmails,
      since
    );

    if (commits.length > 0) {
      console.log(`\n📊 Fetching detailed information... (up to ${commits.length} commits)`);

      // 모든 커밋의 상세 정보 + diff 가져오기
      for (const commit of commits) {
        // 블랙리스트 체크 - 작성자가 블랙리스트에 있으면 스킵
        if (
          blacklistAuthors.length > 0 &&
          blacklistAuthors.includes(commit.commit.author.name)
        ) {
          console.log(
            `   🚫 ${commit.sha.substring(0, 7)} - Blacklisted author (${
              commit.commit.author.name
            }) - skipped`
          );
          continue;
        }

        // DB에 이미 있는지 먼저 확인 (SHA만으로 체크)
        const existingCommit = fetcher.getCommitFromDB(commit.sha);

        if (existingCommit && existingCommit.ai_summary) {
          // 이미 DB에 있고 AI 분석도 완료된 커밋 -> 완전히 스킵
          console.log(
            `   ⏭️  ${commit.sha.substring(0, 7)} - Already processed (skipped)`
          );
          continue;
        }

        // 새 커밋이거나 AI 분석이 없는 경우만 상세 정보 가져오기
        const details = await fetcher.getCommitDetailsWithDiff(
          repo.owner,
          repo.name,
          commit.sha
        );

        if (details) {
          const commitData = {
            repo: `${repo.owner}/${repo.name}`,
            ...details,
          };

          // AI로 커밋 분석 (Mistral API가 활성화된 경우)
          let aiSummary = null;
          if (existingCommit && existingCommit.ai_summary) {
            // 이미 AI 분석이 완료된 커밋
            console.log(`   ⏭️  ${details.sha} - AI analysis completed (skipped)`);
            aiSummary = existingCommit.ai_summary;
          } else if (mistralClient) {
            // 새로운 커밋이거나 AI 분석이 없는 경우
            console.log(`   🤖 ${details.sha} - Analyzing with AI...`);
            aiSummary = await fetcher.analyzeCommitWithAI(commitData);
          }

          // 데이터베이스에 저장
          if (fetcher.saveCommitToDB(commitData, aiSummary)) {
            allResults.push(commitData);
            console.log(
              `   ✅ ${details.sha} - ${details.message.split("\n")[0]}`
            );
            console.log(
              `      ${details.filesChanged} files changed (+${details.additions}/-${details.deletions})`
            );
            if (aiSummary) {
              console.log(`      🤖 ${aiSummary}`);
            }
          }
        }

        // API Rate Limit 고려하여 약간의 딜레이
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("");
  }

  // 결과 요약
  if (allResults.length > 0) {
    console.log(`\n💾 Database save completed: ./data/commits.db`);
    console.log(`   Total ${allResults.length} commit info\n`);

    // 요약 출력
    console.log("📈 Summary:");
    const totalAdditions = allResults.reduce((sum, r) => sum + r.additions, 0);
    const totalDeletions = allResults.reduce((sum, r) => sum + r.deletions, 0);
    const totalFiles = allResults.reduce((sum, r) => sum + r.filesChanged, 0);

    console.log(`   Commits: ${allResults.length}`);
    console.log(`   Lines added: +${totalAdditions}`);
    console.log(`   Lines deleted: -${totalDeletions}`);
    console.log(`   Files changed: ${totalFiles}`);

    // DB 통계
    const totalCommits = db
      .prepare("SELECT COUNT(*) as count FROM commits")
      .get();
    const totalCommitFiles = db
      .prepare("SELECT COUNT(*) as count FROM commit_files")
      .get();
    console.log(`\n📊 Total database statistics:`);
    console.log(`   Total commits: ${totalCommits.count}`);
    console.log(`   Total file changes: ${totalCommitFiles.count}`);
  } else {
    console.log("❌ No commits fetched.");
  }

  // DB 연결 종료
  db.close();
  console.log("\n✨ Done!");
}

// 실행
main().catch(console.error);
