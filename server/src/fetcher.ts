import { Octokit } from '@octokit/rest';
import Database from 'better-sqlite3';
import { Mistral } from '@mistralai/mistralai';

export interface FetchOptions {
  filterAuthors?: string[];
  filterEmails?: string[];
  since?: Date;
}

export interface CommitData {
  sha: string;
  fullSha: string;
  repo: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  additions: number;
  deletions: number;
  totalChanges: number;
  filesChanged: number;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
}

export class GitHubCommitFetcher {
  private octokit: Octokit;
  private db: Database.Database;
  private mistral: Mistral | null;

  constructor(token: string, db: Database.Database, mistralClient: Mistral | null = null) {
    this.octokit = new Octokit({ auth: token });
    this.db = db;
    this.mistral = mistralClient;
  }

  /**
   * 특정 레포의 커밋 목록 가져오기
   */
  async getCommits(
    owner: string,
    repo: string,
    options: FetchOptions = {}
  ): Promise<any[]> {
    const { filterAuthors = [], filterEmails = [], since } = options;

    try {
      console.log(`📦 ${owner}/${repo} 레포지토리에서 커밋 가져오는 중...`);

      const allCommits = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params: any = {
          owner,
          repo,
          per_page: 100,
          page,
        };

        if (since) {
          params.since = since.toISOString();
        }

        const { data } = await this.octokit.repos.listCommits(params);

        if (data.length === 0) {
          hasMore = false;
        } else {
          allCommits.push(...data);
          console.log(`   페이지 ${page}: ${data.length}개 커밋 수집 (총 ${allCommits.length}개)`);

          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      // 필터링
      let filteredData = allCommits;
      const hasFilters = filterAuthors.length > 0 || filterEmails.length > 0;

      if (hasFilters) {
        filteredData = allCommits.filter(commit => {
          const authorName = commit.commit.author?.name;
          const authorEmail = commit.commit.author?.email;
          const authorLogin = commit.author?.login;

          const nameMatch =
            filterAuthors.length === 0 ||
            filterAuthors.some(
              author =>
                authorName?.toLowerCase().includes(author.toLowerCase()) ||
                authorLogin?.toLowerCase().includes(author.toLowerCase())
            );

          const emailMatch =
            filterEmails.length === 0 ||
            filterEmails.some(email =>
              authorEmail?.toLowerCase().includes(email.toLowerCase())
            );

          if (filterAuthors.length > 0 && filterEmails.length > 0) {
            return nameMatch && emailMatch;
          }
          return nameMatch || emailMatch;
        });
        console.log(`   (${allCommits.length}개 중 ${filteredData.length}개가 필터 조건에 맞음)`);
      }

      console.log(`✅ ${filteredData.length}개의 커밋을 찾았습니다.`);
      return filteredData;
    } catch (error: any) {
      console.error(`❌ 에러: ${error.message}`);
      return [];
    }
  }

  /**
   * 커밋의 상세 정보 + 코드 변경 사항 함께 가져오기
   */
  async getCommitDetailsWithDiff(owner: string, repo: string, sha: string): Promise<CommitData | null> {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        sha: data.sha.substring(0, 7),
        fullSha: data.sha,
        repo: `${owner}/${repo}`,
        message: data.commit.message,
        author: data.commit.author?.name || 'Unknown',
        authorEmail: data.commit.author?.email || '',
        date: data.commit.author?.date || new Date().toISOString(),
        additions: data.stats?.additions || 0,
        deletions: data.stats?.deletions || 0,
        totalChanges: data.stats?.total || 0,
        filesChanged: data.files?.length || 0,
        files: (data.files || []).map((f: any) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch,
        })),
      };
    } catch (error: any) {
      console.error(`❌ 커밋 상세+Diff 가져오기 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * 사용자의 모든 레포지토리 목록 가져오기 (Private 포함)
   */
  async getUserRepos(): Promise<any[]> {
    try {
      console.log(`\n👤 레포지토리 목록 가져오는 중...`);

      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
        affiliation: 'owner,collaborator',
      });

      const repos = data.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        language: repo.language,
        description: repo.description,
        updatedAt: repo.updated_at,
      }));

      console.log(`✅ ${repos.length}개의 레포지토리를 찾았습니다.`);
      console.log(`   - Public: ${repos.filter(r => !r.private).length}개`);
      console.log(`   - Private: ${repos.filter(r => r.private).length}개\n`);

      return repos;
    } catch (error: any) {
      console.error(`❌ 레포 목록 가져오기 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * Organization의 모든 레포지토리 목록 가져오기
   */
  async getOrgRepos(org: string): Promise<any[]> {
    try {
      console.log(`\n🏢 Organization "${org}" 레포지토리 목록 가져오는 중...`);

      const allRepos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.repos.listForOrg({
          org,
          per_page: 100,
          page,
          sort: 'updated',
        });

        if (data.length === 0) {
          hasMore = false;
        } else {
          allRepos.push(...data);
          console.log(`   페이지 ${page}: ${data.length}개 레포지토리 수집 (총 ${allRepos.length}개)`);

          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const repos = allRepos.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        language: repo.language,
        description: repo.description,
        updatedAt: repo.updated_at,
      }));

      console.log(`✅ ${repos.length}개의 Organization 레포지토리를 찾았습니다.`);
      console.log(`   - Public: ${repos.filter(r => !r.private).length}개`);
      console.log(`   - Private: ${repos.filter(r => r.private).length}개\n`);

      return repos;
    } catch (error: any) {
      console.error(`❌ Organization 레포 목록 가져오기 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * SHA로 커밋이 DB에 존재하는지 확인
   */
  getCommitFromDB(fullSha: string): { ai_summary: string | null } | null {
    try {
      const commit = this.db.prepare(`
        SELECT ai_summary FROM commits WHERE full_sha = ?
      `).get(fullSha) as { ai_summary: string | null } | undefined;

      return commit || null;
    } catch (error: any) {
      console.error(`❌ DB 조회 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * Mistral AI로 커밋 분석
   */
  async analyzeCommitWithAI(commitData: CommitData): Promise<string | null> {
    if (!this.mistral) {
      return null;
    }

    try {
      const filesInfo = commitData.files
        .map(f => `- ${f.filename} (${f.status}): +${f.additions}/-${f.deletions}`)
        .join('\n');

      const prompt = `다음 Git 커밋을 분석하고 어떤 작업을 했는지 한국어로 간단히 요약해주세요 (2-3문장):

커밋 메시지: ${commitData.message}

변경된 파일:
${filesInfo}

통계: +${commitData.additions}/-${commitData.deletions} (${commitData.filesChanged}개 파일)`;

      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      const summary = typeof content === 'string' ? content.trim() : null;
      return summary;
    } catch (error: any) {
      console.error(`   ⚠️  AI 분석 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * 커밋 정보를 데이터베이스에 저장
   */
  saveCommitToDB(commitData: CommitData, aiSummary: string | null = null): boolean {
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
      this.db.transaction(() => {
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
    } catch (error: any) {
      console.error(`❌ DB 저장 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * Rate Limit 확인
   */
  async checkRateLimit(): Promise<{ remaining: number; limit: number; resetDate: Date }> {
    const { data } = await this.octokit.rateLimit.get();
    const remaining = data.rate.remaining;
    const limit = data.rate.limit;
    const resetDate = new Date(data.rate.reset * 1000);

    console.log(`\n⏱️  API Rate Limit: ${remaining}/${limit}`);
    console.log(`   리셋 시간: ${resetDate.toLocaleString('ko-KR')}\n`);

    return { remaining, limit, resetDate };
  }
}
