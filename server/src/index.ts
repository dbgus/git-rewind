import express, { Request, Response } from "express";
import cors from "cors";
import {
  getCommits,
  getCommitByHash,
  getCommitFiles,
  getStats,
  getCommitsByRepo,
  getCommitsByAuthor,
  getRepos,
  getAuthors,
  getFilteredCount,
  deleteCommitsByAuthors,
  initCommitsTables,
} from "./db.js";
import { getUserRepos, isGitHubConfigured } from "./github.js";
import { GitHubCommitFetcher } from "./fetcher.js";
import {
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getLanguageStats,
  getHourlyStats,
  getTopFiles,
  getAuthorActivityHours,
  getHeatmapData,
} from "./analytics.js";
import { initConfigTable, getConfig, updateConfigs } from "./config.js";
import {
  initTagsTables,
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToCommit,
  removeTagFromCommit,
  getCommitTags,
  getCommitsByTag,
  getTagStats,
} from "./tags.js";
import { jobQueue, type Job } from "./queue.js";
import Database from "better-sqlite3";
import { Mistral } from "@mistralai/mistralai";
import { spawn } from "child_process";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database tables on startup
const dbPath =
  process.env.NODE_ENV === "production"
    ? "/app/data/commits.db"
    : path.join(__dirname, "../../data/commits.db");
const initDb = new Database(dbPath);
initCommitsTables(initDb);
initConfigTable(initDb);
initTagsTables(initDb);
initDb.close();

// Set up job queue worker
jobQueue.setWorker(async (job: Job) => {
  if (job.type === "fetch-commits") {
    const {
      repos,
      filterAuthors,
      filterEmails,
      since,
      limit = 5,
      useAI = false,
    } = job.data;

    const db = new Database(dbPath);
    const config = getConfig(db);

    if (!config.github_token) {
      db.close();
      throw new Error(
        "GitHub token not configured. Please generate a GitHub Personal Access Token at https://github.com/settings/tokens and configure it in the settings."
      );
    }

    let mistralClient = null;
    if (useAI && config.mistral_api_key) {
      mistralClient = new Mistral({ apiKey: config.mistral_api_key });
    }

    const fetcher = new GitHubCommitFetcher(
      config.github_token,
      db,
      mistralClient
    );
    const results = [];
    const sinceDate = since
      ? new Date(since)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d;
        })();

    for (let i = 0; i < repos.length; i++) {
      const repoStr = repos[i];
      const [owner, name] = repoStr.split("/");

      if (!owner || !name) {
        console.error(`Invalid repo format: ${repoStr}`);
        continue;
      }

      // Update progress
      jobQueue.updateProgress(
        job.id,
        Math.round(((i + 1) / repos.length) * 100)
      );

      const commits = await fetcher.getCommits(owner, name, {
        filterAuthors: filterAuthors || [],
        filterEmails: filterEmails || [],
        since: sinceDate,
      });

      if (commits.length > 0) {
        for (const commit of commits.slice(0, limit)) {
          const details = await fetcher.getCommitDetailsWithDiff(
            owner,
            name,
            commit.sha
          );

          if (details) {
            const existingCommit = fetcher.getCommitFromDB(details.fullSha);

            let aiSummary = null;
            if (existingCommit && existingCommit.ai_summary) {
              console.log(
                `   ⏭️  ${details.sha} - AI analysis already done (skip)`
              );
              aiSummary = existingCommit.ai_summary;
            } else if (mistralClient) {
              console.log(`   🤖 ${details.sha} - AI analyzing...`);
              aiSummary = await fetcher.analyzeCommitWithAI(details);
            }

            if (fetcher.saveCommitToDB(details, aiSummary)) {
              results.push({
                sha: details.sha,
                repo: details.repo,
                message: details.message.split("\n")[0],
                author: details.author,
                filesChanged: details.filesChanged,
                additions: details.additions,
                deletions: details.deletions,
                aiSummary,
              });
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    db.close();

    return {
      success: true,
      collected: results.length,
      results,
    };
  }

  if (job.type === "fetch-all") {
    // Update days_back to null before running full fetch
    const db = new Database(dbPath);
    updateConfigs(db, { days_back: null });
    db.close();

    // Run cli.js script directly using child_process
    // Docker: /app/cli.js, Local: ../../cli.js from dist folder
    const scriptPath = process.env.NODE_ENV === 'production'
      ? '/app/cli.js'
      : path.join(__dirname, "../../cli.js");

    const cwd = process.env.NODE_ENV === 'production'
      ? '/app'
      : path.join(__dirname, "../..");

    return new Promise((resolve, reject) => {
      console.log("🚀 Starting full fetch script (cli.js)...");

      const child = spawn("node", [scriptPath], {
        cwd: cwd,
        env: process.env,
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
        console.log(text);

        // Try to parse progress from output
        // Look for patterns like "Processing 5 of 10 repositories"
        const progressMatch = text.match(/(\d+)\/(\d+)/);
        if (progressMatch) {
          const current = parseInt(progressMatch[1]);
          const total = parseInt(progressMatch[2]);
          const progress = Math.round((current / total) * 100);
          jobQueue.updateProgress(job.id, progress);
        }
      });

      child.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error(text);
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Full fetch script completed successfully");

          // Parse results from output
          const commitsMatch = output.match(/총 (\d+)개의 커밋/);
          const collected = commitsMatch ? parseInt(commitsMatch[1]) : 0;

          resolve({
            success: true,
            collected,
            output,
          });
        } else {
          console.error("❌ Full fetch script failed with code:", code);
          reject(new Error(`Script exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on("error", (error) => {
        console.error("❌ Failed to start script:", error);
        reject(error);
      });
    });
  }

  throw new Error(`Unknown job type: ${job.type}`);
});

// 헬스 체크
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// 전체 통계
app.get("/api/stats", (_req: Request, res: Response) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 커밋 목록
app.get("/api/commits", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const filters = {
      search: req.query.search as string | undefined,
      repo: req.query.repo as string | undefined,
      author: req.query.author as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const commits = getCommits(limit, offset, filters);
    const totalCount = getFilteredCount(filters);
    res.json({ commits, totalCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commits" });
  }
});

// 특정 커밋 상세
app.get("/api/commits/:sha", (req: Request, res: Response) => {
  try {
    const { sha } = req.params;
    const commit = getCommitByHash(sha);

    if (!commit) {
      return res.status(404).json({ error: "Commit not found" });
    }

    const files = getCommitFiles(commit.full_sha);
    res.json({ ...commit, files });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commit details" });
  }
});

// 레포지토리별 커밋
app.get("/api/repos/:repo/commits", (req: Request, res: Response) => {
  try {
    const repo = decodeURIComponent(req.params.repo);
    const limit = parseInt(req.query.limit as string) || 50;
    const commits = getCommitsByRepo(repo, limit);
    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commits by repo" });
  }
});

// 작성자별 커밋
app.get("/api/authors/:author/commits", (req: Request, res: Response) => {
  try {
    const { author } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const commits = getCommitsByAuthor(author, limit);
    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commits by author" });
  }
});

// 레포지토리 목록
app.get("/api/repos", (_req: Request, res: Response) => {
  try {
    const repos = getRepos();
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

// 작성자 목록
app.get("/api/authors", (_req: Request, res: Response) => {
  try {
    const authors = getAuthors();
    res.json(authors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch authors" });
  }
});

// GitHub 사용자의 레포지토리 목록 가져오기
app.get("/api/github/repos", async (req: Request, res: Response) => {
  try {
    const db = new Database(dbPath, { readonly: true });
    const config = getConfig(db);

    if (!config.github_token) {
      db.close();
      return res.status(503).json({
        error: "GitHub token not configured",
        message:
          "Please generate a GitHub Personal Access Token at https://github.com/settings/tokens and configure it in the settings.",
      });
    }

    const fetcher = new GitHubCommitFetcher(config.github_token, db);
    const repos = await fetcher.getUserRepos();
    db.close();

    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch GitHub repos" });
  }
});

// Organization의 레포지토리 목록 가져오기
app.get("/api/github/org/:org/repos", async (req: Request, res: Response) => {
  try {
    const { org } = req.params;

    if (!org) {
      return res.status(400).json({ error: "Organization name is required" });
    }

    const db = new Database(dbPath, { readonly: true });
    const config = getConfig(db);

    if (!config.github_token) {
      db.close();
      return res.status(503).json({
        error: "GitHub token not configured",
        message:
          "Please generate a GitHub Personal Access Token at https://github.com/settings/tokens and configure it in the settings.",
      });
    }

    const fetcher = new GitHubCommitFetcher(config.github_token, db);
    const repos = await fetcher.getOrgRepos(org);
    db.close();

    res.json(repos);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch organization repos" });
  }
});

// GitHub 설정 상태 확인
app.get("/api/github/status", (_req: Request, res: Response) => {
  const db = new Database(dbPath, { readonly: true });
  const config = getConfig(db);
  db.close();

  res.json({
    configured: !!config.github_token,
    username: config.github_username || null,
  });
});

// 커밋 수집 API - 큐에 작업 추가
app.post("/api/fetch/commits", async (req: Request, res: Response) => {
  try {
    const {
      repos,
      filterAuthors,
      filterEmails,
      since,
      limit = 5,
      useAI = false,
    } = req.body;

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
      return res.status(400).json({ error: "repos array is required" });
    }

    // Add job to queue
    const jobId = jobQueue.addJob("fetch-commits", {
      repos,
      filterAuthors,
      filterEmails,
      since,
      limit,
      useAI,
    });

    res.json({
      success: true,
      jobId,
      message: "Job added to queue",
    });
  } catch (error: any) {
    console.error("Fetch error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to add job to queue" });
  }
});

// Get job status
app.get("/api/jobs/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

// Get all jobs
app.get("/api/jobs", (_req: Request, res: Response) => {
  const jobs = jobQueue.getAllJobs();
  res.json(jobs);
});

// Get queue stats
app.get("/api/queue/stats", (_req: Request, res: Response) => {
  const stats = jobQueue.getStats();
  res.json(stats);
});

// Fetch all commits from GitHub (runs full fetch)
app.post("/api/fetch/all", async (_req: Request, res: Response) => {
  try {
    const jobId = jobQueue.addJob("fetch-all", {});

    res.json({
      success: true,
      jobId,
      message: "Full fetch job added to queue",
    });
  } catch (error: any) {
    console.error("Fetch all error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to add fetch-all job to queue" });
  }
});

// Rate limit 확인
app.get("/api/github/rate-limit", async (_req: Request, res: Response) => {
  try {
    const db = new Database(dbPath, { readonly: true });
    const config = getConfig(db);

    if (!config.github_token) {
      db.close();
      return res.status(503).json({
        error: "GitHub token not configured",
        message:
          "Please generate a GitHub Personal Access Token at https://github.com/settings/tokens and configure it in the settings.",
      });
    }

    const fetcher = new GitHubCommitFetcher(config.github_token, db);
    const rateLimit = await fetcher.checkRateLimit();
    db.close();

    res.json(rateLimit);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check rate limit" });
  }
});

// Analytics APIs
app.get("/api/analytics/daily", (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = getDailyStats(days);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily stats" });
  }
});

app.get("/api/analytics/weekly", (req: Request, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 12;
    const stats = getWeeklyStats(weeks);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch weekly stats" });
  }
});

app.get("/api/analytics/monthly", (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const stats = getMonthlyStats(months);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch monthly stats" });
  }
});

app.get("/api/analytics/languages", (_req: Request, res: Response) => {
  try {
    const stats = getLanguageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch language stats" });
  }
});

app.get("/api/analytics/hourly", (_req: Request, res: Response) => {
  try {
    const stats = getHourlyStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hourly stats" });
  }
});

app.get("/api/analytics/top-files", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const files = getTopFiles(limit);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch top files" });
  }
});

app.get(
  "/api/analytics/author/:author/hours",
  (req: Request, res: Response) => {
    try {
      const { author } = req.params;
      const stats = getAuthorActivityHours(author);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch author activity hours" });
    }
  }
);

app.get("/api/analytics/heatmap", (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const data = getHeatmapData(days);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch heatmap data" });
  }
});

// Config APIs
app.get("/api/config", (_req: Request, res: Response) => {
  try {
    const db = new Database(dbPath);
    const config = getConfig(db);
    db.close();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

app.put("/api/config", (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const db = new Database(dbPath);
    updateConfigs(db, updates);
    const updatedConfig = getConfig(db);
    db.close();
    res.json(updatedConfig);
  } catch (error) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

// 블랙리스트 작성자 커밋 삭제
app.delete("/api/commits/by-authors", (req: Request, res: Response) => {
  try {
    const { authors } = req.body;
    if (!authors || !Array.isArray(authors) || authors.length === 0) {
      return res.status(400).json({ error: "authors array is required" });
    }
    console.log("Deleting commits from authors:", authors);
    const deletedCount = deleteCommitsByAuthors(authors);
    console.log("Deleted", deletedCount, "commits");
    res.json({ deletedCount, authors });
  } catch (error) {
    console.error("Delete commits error:", error);
    res.status(500).json({
      error: "Failed to delete commits",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Tags APIs
app.get("/api/tags", (_req: Request, res: Response) => {
  try {
    const db = new Database(dbPath);
    const tags = getAllTags(db);
    db.close();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

app.post("/api/tags", (req: Request, res: Response) => {
  try {
    const { name, color, description } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: "name and color are required" });
    }
    const db = new Database(dbPath);
    const tag = createTag(db, name, color, description);
    db.close();
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: "Failed to create tag" });
  }
});

app.put("/api/tags/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: "name and color are required" });
    }
    const db = new Database(dbPath);
    const tag = updateTag(db, parseInt(id), name, color, description);
    db.close();
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: "Failed to update tag" });
  }
});

app.delete("/api/tags/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = new Database(dbPath);
    const success = deleteTag(db, parseInt(id));
    db.close();
    if (!success) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

app.get("/api/tags/stats", (_req: Request, res: Response) => {
  try {
    const db = new Database(dbPath);
    const stats = getTagStats(db);
    db.close();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tag stats" });
  }
});

app.get("/api/commits/:sha/tags", (req: Request, res: Response) => {
  try {
    const { sha } = req.params;
    const db = new Database(dbPath);
    const tags = getCommitTags(db, sha);
    db.close();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commit tags" });
  }
});

app.post("/api/commits/:sha/tags/:tagId", (req: Request, res: Response) => {
  try {
    const { sha, tagId } = req.params;
    const db = new Database(dbPath);
    addTagToCommit(db, sha, parseInt(tagId));
    const tags = getCommitTags(db, sha);
    db.close();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: "Failed to add tag to commit" });
  }
});

app.delete("/api/commits/:sha/tags/:tagId", (req: Request, res: Response) => {
  try {
    const { sha, tagId } = req.params;
    const db = new Database(dbPath);
    removeTagFromCommit(db, sha, parseInt(tagId));
    const tags = getCommitTags(db, sha);
    db.close();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: "Failed to remove tag from commit" });
  }
});

app.get("/api/tags/:id/commits", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const db = new Database(dbPath);
    const commits = getCommitsByTag(db, parseInt(id), limit, offset);
    db.close();
    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commits by tag" });
  }
});

// Generate resume-ready work summary with AI
app.post("/api/generate-resume-summary", async (req: Request, res: Response) => {
  try {
    const { repos, periodFilter, selectedCategories } = req.body;

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
      return res.status(400).json({ error: "repos array is required" });
    }

    const db = new Database(dbPath);
    const config = getConfig(db);

    if (!config.mistral_api_key) {
      db.close();
      return res.status(503).json({
        error: "Mistral API key not configured",
        message: "Please configure Mistral API key in settings to use AI-powered resume generation.",
      });
    }

    // DB에서 선택된 레포지토리의 커밋 데이터 조회
    const repoConditions = repos.map(() => "repo = ?").join(" OR ");
    const query = `
      SELECT
        repo,
        message,
        author,
        date,
        additions,
        deletions,
        total_changes,
        files_changed,
        ai_summary
      FROM commits
      WHERE (${repoConditions})
        AND ai_summary IS NOT NULL
      ORDER BY date DESC
    `;

    const commits = db.prepare(query).all(...repos) as any[];

    // 기간 필터 적용
    let filteredCommits = commits;
    if (periodFilter && periodFilter !== "all") {
      const now = new Date();
      const monthsAgo = periodFilter === "3months" ? 3 : periodFilter === "6months" ? 6 : 12;
      const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, now.getDate());

      filteredCommits = commits.filter((c) => new Date(c.date) >= cutoffDate);
    }

    db.close();

    if (filteredCommits.length === 0) {
      return res.status(400).json({ error: "No commits found for selected repositories" });
    }

    // 레포지토리별로 그룹화 및 요약
    const repoMap = new Map<string, any[]>();
    filteredCommits.forEach((commit) => {
      if (!repoMap.has(commit.repo)) {
        repoMap.set(commit.repo, []);
      }
      repoMap.get(commit.repo)!.push(commit);
    });

    const workSummary = Array.from(repoMap.entries()).map(([repo, commits]) => {
      const totalCommits = commits.length;
      const totalChanges = commits.reduce((sum, c) => sum + c.total_changes, 0);
      const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
      const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

      const dates = commits.map((c) => new Date(c.date).getTime());
      const earliest = new Date(Math.min(...dates));
      const latest = new Date(Math.max(...dates));
      const period = `${earliest.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })} ~ ${latest.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}`;

      // AI 요약들을 샘플링 (너무 많으면 일부만)
      const sampleSummaries = commits
        .slice(0, 30)
        .map((c) => c.ai_summary)
        .filter(Boolean);

      return {
        repo,
        period,
        totalCommits,
        totalChanges,
        totalAdditions,
        totalDeletions,
        sampleSummaries,
      };
    });

    const mistralClient = new Mistral({ apiKey: config.mistral_api_key });

    // AI 프롬프트 구성
    const prompt = `다음은 개발자의 프로젝트 활동 내역입니다. 이를 이력서에 사용할 수 있도록 전문적이고 간결하게 정리해주세요.

입력 데이터:
${JSON.stringify(workSummary, null, 2)}

다음 형식으로 마크다운을 작성해주세요:

# 프로젝트 경험 및 기술 역량

## 📊 핵심 역량 요약
- 주요 기술 스택과 경험을 2-3줄로 요약

---

## 프로젝트별 상세 내역

각 프로젝트마다:

### 📦 [프로젝트명]

**기간**: [활동 기간]
**기여도**: [커밋 수]개 커밋, [변경 라인 수] 변경

**역할 및 성과**:
- 주요 성과 1 (구체적인 수치 포함)
- 주요 성과 2 (구체적인 수치 포함)
- 주요 성과 3 (구체적인 수치 포함)

**기술 스택**: [AI 요약에서 추출한 기술들]

**주요 구현 내용**:
- [간결한 설명, 1-2줄]
- [간결한 설명, 1-2줄]

---

작성 시 주의사항:
1. sampleSummaries에 있는 AI 요약들을 분석해서 실제로 수행한 작업을 파악
2. 기술적 성과를 구체적인 수치(커밋 수, 변경 라인 수 등)와 함께 표현
3. "~했습니다" 보다는 "~하여 [결과]를 달성" 형태로 작성
4. 각 항목은 간결하게 1-2줄 이내로
5. 이력서에 바로 복사-붙여넣기 할 수 있도록 전문적인 톤 유지
6. 불필요한 커밋 해시나 기술적 세부사항은 제외
7. AI 요약에서 언급된 기술 스택과 구현 내용을 중심으로 정리`;

    const chatResponse = await mistralClient.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: prompt }],
    });

    const resumeContent = chatResponse.choices?.[0]?.message?.content || "";

    res.json({
      success: true,
      content: resumeContent,
    });
  } catch (error: any) {
    console.error("Resume generation error:", error);
    res.status(500).json({
      error: "Failed to generate resume summary",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
