import { useEffect, useState } from "react";
import {
  fetchRepos,
  fetchCommits,
  generateResumeSummary,
  type Commit,
} from "./api";
import Toast from "./components/Toast";

interface WorkDetail {
  title: string;
  description: string;
  commits: Commit[];
}

interface WorkCategory {
  category: string;
  icon: string;
  count: number;
  details: WorkDetail[];
}

interface RepoWork {
  repo: string;
  commitCount: number;
  period: string;
  totalChanges: number;
  categories: WorkCategory[];
  commits: Commit[];
}

type PeriodFilter = "all" | "3months" | "6months" | "1year";
type ExportFormat = "markdown" | "json" | "csv";

function WorkSummary() {
  const [repoWorks, setRepoWorks] = useState<RepoWork[]>([]);
  const [filteredRepoWorks, setFilteredRepoWorks] = useState<RepoWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  useEffect(() => {
    loadWorkSummary();
  }, []);

  useEffect(() => {
    applyPeriodFilter();
  }, [repoWorks, periodFilter]);

  const loadWorkSummary = async () => {
    try {
      setLoading(true);
      const repos = await fetchRepos();

      // 각 레포별로 커밋 가져오기
      const repoWorksData: RepoWork[] = [];

      for (const repo of repos) {
        const commitsResponse = await fetchCommits(1000, 0, {
          repo: repo.repo,
        });
        const commits = commitsResponse.commits.filter((c) => c.ai_summary);

        if (commits.length > 0) {
          const categories = categorizeWork(commits);
          const period = calculatePeriod(commits);
          const totalChanges = commits.reduce(
            (sum, c) => sum + c.total_changes,
            0
          );

          repoWorksData.push({
            repo: repo.repo,
            commitCount: commits.length,
            period,
            totalChanges,
            categories,
            commits,
          });
        }
      }

      setRepoWorks(repoWorksData);
    } catch (error) {
      console.error("Failed to load work summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeWork = (commits: Commit[]): WorkCategory[] => {
    const categories = new Map<string, { icon: string; commits: Commit[] }>();

    const categoryPatterns = [
      {
        key: "New Features",
        icon: "✨",
        patterns: [
          "기능 추가",
          "기능을 추가",
          "새로운 기능",
          "구현",
          "추가했습니다",
          "추가함",
          "feat",
          "feature",
          "implement",
          "add",
        ],
      },
      {
        key: "Bug Fixes",
        icon: "🐛",
        patterns: [
          "버그 수정",
          "수정",
          "버그를 수정",
          "오류 해결",
          "문제 해결",
          "fix",
          "bug",
          "resolve",
        ],
      },
      {
        key: "Refactoring",
        icon: "♻️",
        patterns: [
          "리팩토링",
          "코드 개선",
          "구조 개선",
          "정리",
          "refactor",
          "restructure",
          "cleanup",
        ],
      },
      {
        key: "Performance",
        icon: "⚡",
        patterns: [
          "성능 개선",
          "최적화",
          "속도 개선",
          "performance",
          "optimize",
          "speed",
        ],
      },
      {
        key: "UI/UX",
        icon: "🎨",
        patterns: [
          "UI",
          "UX",
          "디자인",
          "스타일",
          "화면",
          "design",
          "style",
          "layout",
        ],
      },
      {
        key: "Testing",
        icon: "✅",
        patterns: ["테스트", "test", "testing", "spec"],
      },
      {
        key: "API",
        icon: "🔌",
        patterns: ["API", "endpoint", "엔드포인트", "rest", "graphql"],
      },
      {
        key: "Database",
        icon: "💾",
        patterns: [
          "데이터베이스",
          "DB",
          "스키마",
          "마이그레이션",
          "database",
          "schema",
          "migration",
        ],
      },
      {
        key: "Security",
        icon: "🔒",
        patterns: [
          "보안",
          "security",
          "인증",
          "권한",
          "auth",
          "authentication",
          "authorization",
        ],
      },
      {
        key: "Configuration",
        icon: "⚙️",
        patterns: [
          "설정",
          "배포",
          "config",
          "deploy",
          "setup",
          "configuration",
        ],
      },
      {
        key: "Documentation",
        icon: "📝",
        patterns: [
          "문서",
          "documentation",
          "주석",
          "README",
          "docs",
          "comment",
        ],
      },
    ];

    commits.forEach((commit) => {
      const summary = (commit.ai_summary || "").toLowerCase();
      const message = commit.message.toLowerCase();
      const text = `${summary} ${message}`;

      categoryPatterns.forEach(({ key, icon, patterns }) => {
        patterns.forEach((pattern) => {
          if (text.includes(pattern.toLowerCase())) {
            if (!categories.has(key)) {
              categories.set(key, { icon, commits: [] });
            }
            categories.get(key)!.commits.push(commit);
          }
        });
      });
    });

    return Array.from(categories.entries())
      .map(([category, { icon, commits: categoryCommits }]) => ({
        category,
        icon,
        count: categoryCommits.length,
        details: extractWorkDetails(categoryCommits),
      }))
      .sort((a, b) => b.count - a.count);
  };

  const extractWorkDetails = (commits: Commit[]): WorkDetail[] => {
    // AI 요약에서 핵심 작업 내용을 추출
    const workMap = new Map<string, Commit[]>();

    commits.forEach((commit) => {
      if (!commit.ai_summary) return;

      // AI 요약에서 주요 문장 추출 (마침표로 분리)
      const sentences = commit.ai_summary
        .split(/[.。]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10 && s.length < 200);

      sentences.forEach((sentence) => {
        // 비슷한 내용 그룹화를 위한 키 추출
        const key = extractWorkKey(sentence);
        if (key) {
          if (!workMap.has(key)) {
            workMap.set(key, []);
          }
          workMap.get(key)!.push(commit);
        }
      });
    });

    // 작업 상세 내역 생성
    return Array.from(workMap.entries())
      .map(([key, relatedCommits]) => {
        // 대표 커밋의 AI 요약을 설명으로 사용
        const representativeCommit = relatedCommits[0];
        const description = representativeCommit.ai_summary || "";

        return {
          title: key,
          description:
            description.substring(0, 150) +
            (description.length > 150 ? "..." : ""),
          commits: relatedCommits,
        };
      })
      .sort((a, b) => b.commits.length - a.commits.length)
      .slice(0, 10); // 상위 10개만
  };

  const extractWorkKey = (sentence: string): string | null => {
    // 패턴 매칭으로 작업 제목 추출
    const patterns = [
      // "~을/를 추가", "~을/를 구현"
      /(.{5,30}?)(?:을|를)\s*(?:추가|구현|개발|작성|생성)/,
      // "~을/를 수정", "~을/를 개선"
      /(.{5,30}?)(?:을|를)\s*(?:수정|개선|변경|업데이트)/,
      // "~ 기능", "~ 시스템"
      /(.{5,30}?)\s*(?:기능|시스템|모듈|컴포넌트|서비스)/,
      // 영어 패턴
      /(?:implement|add|create)\s+(.{5,30})/i,
      /(?:fix|update|improve)\s+(.{5,30})/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 패턴 매칭 실패시 문장 앞부분 사용
    if (sentence.length > 15) {
      return sentence.substring(0, 40);
    }

    return null;
  };

  const calculatePeriod = (commits: Commit[]): string => {
    if (commits.length === 0) return "";

    const dates = commits.map((c) => new Date(c.date).getTime());
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
      });
    };

    if (earliest.getTime() === latest.getTime()) {
      return formatDate(earliest);
    }

    return `${formatDate(earliest)} ~ ${formatDate(latest)}`;
  };

  const applyPeriodFilter = () => {
    if (periodFilter === "all") {
      setFilteredRepoWorks(repoWorks);
      return;
    }

    const now = new Date();
    const monthsAgo =
      periodFilter === "3months" ? 3 : periodFilter === "6months" ? 6 : 12;
    const cutoffDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthsAgo,
      now.getDate()
    );

    const filtered = repoWorks
      .map((repoWork) => {
        const filteredCommits = repoWork.commits.filter(
          (commit) => new Date(commit.date) >= cutoffDate
        );

        if (filteredCommits.length === 0) return null;

        const categories = categorizeWork(filteredCommits);
        const period = calculatePeriod(filteredCommits);
        const totalChanges = filteredCommits.reduce(
          (sum, c) => sum + c.total_changes,
          0
        );

        return {
          ...repoWork,
          commitCount: filteredCommits.length,
          period,
          totalChanges,
          categories,
          commits: filteredCommits,
        };
      })
      .filter((rw) => rw !== null) as RepoWork[];

    setFilteredRepoWorks(filtered);
  };

  const toggleRepo = (repo: string) => {
    setExpandedRepo(expandedRepo === repo ? null : repo);
  };

  const toggleRepoSelection = (repo: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repo)) {
      newSelected.delete(repo);
    } else {
      newSelected.add(repo);
    }
    setSelectedRepos(newSelected);
  };

  const selectAllRepos = () => {
    setSelectedRepos(new Set(filteredRepoWorks.map((rw) => rw.repo)));
  };

  const deselectAllRepos = () => {
    setSelectedRepos(new Set());
  };

  const getAllCategories = (): string[] => {
    const categories = new Set<string>();
    filteredRepoWorks.forEach((rw) => {
      rw.categories.forEach((cat) => categories.add(cat.category));
    });
    return Array.from(categories);
  };

  const toggleCategory = (category: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  const selectAllCategories = () => {
    setSelectedCategories(new Set(getAllCategories()));
  };

  const deselectAllCategories = () => {
    setSelectedCategories(new Set());
  };

  const filterByCategories = (repos: RepoWork[]): RepoWork[] => {
    if (selectedCategories.size === 0) return repos;

    return repos
      .map((repoWork) => {
        const filteredCategories = repoWork.categories.filter((cat) =>
          selectedCategories.has(cat.category)
        );

        if (filteredCategories.length === 0) return null;

        return {
          ...repoWork,
          categories: filteredCategories,
        };
      })
      .filter((rw) => rw !== null) as RepoWork[];
  };

  const generateMarkdown = (repos: RepoWork[]): string => {
    const filteredRepos = filterByCategories(repos);

    let markdown = "# Work Summary\n\n";
    markdown += `Generated: ${new Date().toLocaleDateString("en-US")}\n\n`;
    if (periodFilter !== "all") {
      const periodLabel =
        periodFilter === "3months"
          ? "Last 3 Months"
          : periodFilter === "6months"
          ? "Last 6 Months"
          : "Last Year";
      markdown += `Period: ${periodLabel}\n\n`;
    }
    markdown += "---\n\n";

    filteredRepos.forEach((repoWork) => {
      markdown += `## ${repoWork.repo}\n\n`;
      markdown += `- **Period**: ${repoWork.period}\n`;
      markdown += `- **Commits**: ${repoWork.commitCount}\n`;
      markdown += `- **Total Changes**: ${repoWork.totalChanges.toLocaleString()} lines\n\n`;

      repoWork.categories.forEach((cat) => {
        markdown += `### ${cat.icon} ${cat.category} (${cat.count} items)\n\n`;

        cat.details.forEach((detail) => {
          markdown += `#### ${detail.title}\n\n`;
          markdown += `${detail.description}\n\n`;

          if (detail.commits.length > 0) {
            markdown += "**Related Commits:**\n";
            detail.commits.slice(0, 5).forEach((commit) => {
              markdown += `- \`${commit.sha}\` ${
                commit.message.split("\n")[0]
              }\n`;
            });
            if (detail.commits.length > 5) {
              markdown += `- ... and ${detail.commits.length - 5} more\n`;
            }
            markdown += "\n";
          }
        });
      });

      markdown += "---\n\n";
    });

    return markdown;
  };

  const generateJSON = (repos: RepoWork[]): string => {
    const filteredRepos = filterByCategories(repos);
    const data = {
      generated: new Date().toISOString(),
      periodFilter: periodFilter !== "all" ? periodFilter : undefined,
      repositories: filteredRepos.map((rw) => ({
        name: rw.repo,
        period: rw.period,
        commitCount: rw.commitCount,
        totalChanges: rw.totalChanges,
        categories: rw.categories.map((cat) => ({
          category: cat.category,
          icon: cat.icon,
          count: cat.count,
          details: cat.details.map((detail) => ({
            title: detail.title,
            description: detail.description,
            commits: detail.commits.map((c) => ({
              sha: c.sha,
              message: c.message.split("\n")[0],
              date: c.date,
              author: c.author,
            })),
          })),
        })),
      })),
    };
    return JSON.stringify(data, null, 2);
  };

  const generateCSV = (repos: RepoWork[]): string => {
    const filteredRepos = filterByCategories(repos);
    let csv =
      "Repository,Category,Work Title,Description,Commit Count,Commit SHAs\n";

    filteredRepos.forEach((repoWork) => {
      repoWork.categories.forEach((cat) => {
        cat.details.forEach((detail) => {
          const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
          const shas = detail.commits.map((c) => c.sha).join("; ");
          csv += `${escapeCsv(repoWork.repo)},${escapeCsv(
            cat.category
          )},${escapeCsv(detail.title)},${escapeCsv(detail.description)},${
            detail.commits.length
          },${escapeCsv(shas)}\n`;
        });
      });
    });

    return csv;
  };

  const downloadFile = async () => {
    const selectedRepoWorks = filteredRepoWorks.filter((rw) =>
      selectedRepos.has(rw.repo)
    );

    if (selectedRepoWorks.length === 0) {
      setToast({
        message: "⚠️ Please select repositories to export.",
        type: "warning",
      });
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    // Markdown 포맷인 경우 AI로 이력서용으로 재작성
    if (exportFormat === "markdown") {
      try {
        // Toast로 진행 상태 표시
        setToast({
          message: "🤖 Generating resume document with AI... Please wait.",
          type: "info",
        });

        // 선택된 레포지토리 이름만 전달
        const selectedRepoNames = selectedRepoWorks.map((rw) => rw.repo);
        const categories =
          selectedCategories.size > 0
            ? Array.from(selectedCategories)
            : undefined;

        const result = await generateResumeSummary(
          selectedRepoNames,
          periodFilter !== "all" ? periodFilter : undefined,
          categories
        );
        content = result.content;
        mimeType = "text/markdown";
        extension = "md";

        setToast({
          message: "Resume document generated successfully!",
          type: "success",
        });
      } catch (error) {
        console.error("AI generation failed:", error);
        setToast({
          message:
            "❌ AI generation failed. Downloading default markdown instead.",
          type: "error",
        });
        content = generateMarkdown(selectedRepoWorks);
        mimeType = "text/markdown";
        extension = "md";
      }
    } else if (exportFormat === "json") {
      content = generateJSON(selectedRepoWorks);
      mimeType = "application/json";
      extension = "json";
    } else {
      content = generateCSV(selectedRepoWorks);
      mimeType = "text/csv";
      extension = "csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${
      new Date().toISOString().split("T")[0]
    }.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[var(--color-text-secondary)]">
        Loading work summary...
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
          📋 Work Summary
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Categorized work history by repository for resume and retrospective
          writing
        </p>
      </div>

      {filteredRepoWorks.length > 0 && (
        <>
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 mb-4 md:mb-6 flex flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-2 md:gap-3">
              <label className="text-[var(--color-text-primary)] font-semibold text-xs sm:text-sm">
                Period Filter:
              </label>
              <div className="grid grid-cols-2 sm:flex gap-2 flex-wrap">
                <button
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    periodFilter === "all"
                      ? "bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/30"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)]"
                  }`}
                  onClick={() => setPeriodFilter("all")}
                >
                  All Time
                </button>
                <button
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    periodFilter === "3months"
                      ? "bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/30"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)]"
                  }`}
                  onClick={() => setPeriodFilter("3months")}
                >
                  3 Months
                </button>
                <button
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    periodFilter === "6months"
                      ? "bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/30"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)]"
                  }`}
                  onClick={() => setPeriodFilter("6months")}
                >
                  6 Months
                </button>
                <button
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    periodFilter === "1year"
                      ? "bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/30"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)]"
                  }`}
                  onClick={() => setPeriodFilter("1year")}
                >
                  1 Year
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:gap-3">
              <label className="text-[var(--color-text-primary)] font-semibold text-xs sm:text-sm">
                Category Filter:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllCategories}
                  className="px-2.5 sm:px-3 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] text-xs font-medium hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)] transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllCategories}
                  className="px-2.5 sm:px-3 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] text-xs font-medium hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)] transition-all"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 p-2 sm:p-3 bg-[var(--color-bg-tertiary)] rounded-md">
                {getAllCategories().map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-secondary)] text-xs sm:text-sm cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(category)}
                      onChange={() => toggleCategory(category)}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 cursor-pointer accent-[var(--color-accent-primary)]"
                    />
                    <span className="whitespace-nowrap">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 mb-6 md:mb-8 flex flex-col gap-3 sm:gap-4">
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={selectAllRepos}
                className="px-3 sm:px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-xs sm:text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)] transition-all"
              >
                Select All
              </button>
              <button
                onClick={deselectAllRepos}
                className="px-3 sm:px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-xs sm:text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent-primary)] transition-all"
              >
                Deselect All
              </button>
              <span className="px-2.5 sm:px-3 py-2 bg-[var(--color-bg-tertiary)] rounded-md text-[var(--color-text-secondary)] text-xs sm:text-sm font-medium">
                {selectedRepos.size} selected
              </span>
            </div>

            <div className="flex gap-2 sm:gap-3 items-stretch sm:items-center flex-col sm:flex-row">
              <label className="text-[var(--color-text-secondary)] text-xs sm:text-sm font-medium sm:whitespace-nowrap">
                Export Format:
              </label>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as ExportFormat)
                }
                className="flex-1 sm:flex-initial px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-xs sm:text-sm font-medium cursor-pointer hover:border-[var(--color-accent-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/10 transition-all"
              >
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button
                onClick={downloadFile}
                disabled={selectedRepos.size === 0}
                className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  selectedRepos.size === 0
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
                    : "bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-hover)] sm:hover:-translate-y-0.5 shadow-lg shadow-[var(--color-accent-primary)]/40"
                }`}
              >
                📥 Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 md:gap-8">
        {filteredRepoWorks.map((repoWork) => (
          <div
            key={repoWork.repo}
            className={`bg-[var(--color-bg-secondary)] border rounded-lg sm:rounded-xl overflow-hidden transition-all ${
              selectedRepos.has(repoWork.repo)
                ? "border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/15"
                : "border-[var(--color-border)] hover:border-[var(--color-accent-primary)] hover:shadow-md hover:shadow-[var(--color-accent-primary)]/10"
            }`}
          >
            <div
              className="flex justify-between items-center p-3 sm:p-4 md:p-6 cursor-pointer select-none bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] hover:from-[var(--color-bg-hover)] hover:to-[var(--color-bg-tertiary)] transition-all"
              onClick={() => toggleRepo(repoWork.repo)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <input
                    type="checkbox"
                    checked={selectedRepos.has(repoWork.repo)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleRepoSelection(repoWork.repo);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer accent-[var(--color-accent-primary)] flex-shrink-0"
                  />
                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] truncate">
                    {repoWork.repo}
                  </h3>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  <span className="inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[var(--color-accent-primary)] text-white text-xs font-medium">
                    {repoWork.commitCount} commits
                  </span>
                  <span className="inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[var(--color-success)] text-white text-xs font-medium">
                    {repoWork.totalChanges.toLocaleString()} lines
                  </span>
                </div>
              </div>
              <button className="text-[var(--color-text-secondary)] text-xl sm:text-2xl p-1 sm:p-2 hover:text-[var(--color-accent-primary)] hover:scale-110 transition-all min-w-[32px] sm:min-w-[40px] flex-shrink-0">
                {expandedRepo === repoWork.repo ? "▼" : "▶"}
              </button>
            </div>

            <div className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 text-[var(--color-text-muted)] text-xs sm:text-sm">
              <span>📅 {repoWork.period}</span>
            </div>

            {expandedRepo === repoWork.repo && (
              <div className="p-3 sm:p-4 md:p-6 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)] grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {repoWork.categories.map((cat) => (
                  <div
                    key={cat.category}
                    className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 sm:p-4 md:p-6"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-5 pb-2 sm:pb-3 border-b-2 border-[var(--color-border)]">
                      <span className="text-lg sm:text-xl flex-shrink-0">
                        {cat.icon}
                      </span>
                      <span className="text-[var(--color-text-primary)] font-semibold text-xs sm:text-sm flex-1 truncate">
                        {cat.category}
                      </span>
                      <span className="bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-medium whitespace-nowrap">
                        {cat.count} items
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 sm:gap-4 md:gap-5">
                      {cat.details.map((detail, idx) => (
                        <div
                          key={idx}
                          className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md p-2.5 sm:p-3 md:p-4 hover:border-[var(--color-accent-primary)] sm:hover:translate-x-1 transition-all"
                        >
                          <div className="flex justify-between items-start gap-2 mb-1.5 sm:mb-2">
                            <span className="text-[var(--color-text-primary)] font-semibold text-xs sm:text-sm flex-1 leading-snug">
                              ▸ {detail.title}
                            </span>
                            <span className="bg-[var(--color-accent-primary)] text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0">
                              {detail.commits.length}
                            </span>
                          </div>
                          <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed mb-2 sm:mb-3 md:mb-3.5 pl-2 sm:pl-4">
                            {detail.description}
                          </p>
                          <div className="flex flex-col gap-1 sm:gap-1.5 pl-2 sm:pl-4">
                            {detail.commits.slice(0, 3).map((commit) => (
                              <div
                                key={commit.sha}
                                className="flex gap-1.5 sm:gap-2.5 items-center p-1 sm:p-1.5 bg-[var(--color-bg-secondary)] rounded text-xs"
                              >
                                <code className="font-mono bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] px-1 sm:px-1.5 py-0.5 rounded text-[var(--color-accent-primary)] text-[10px] sm:text-xs flex-shrink-0">
                                  {commit.sha}
                                </code>
                                <span className="text-[var(--color-text-muted)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] sm:text-xs">
                                  {commit.message
                                    .split("\n")[0]
                                    .substring(0, 40)}
                                  ...
                                </span>
                              </div>
                            ))}
                            {detail.commits.length > 3 && (
                              <div className="text-[var(--color-text-muted)] text-xs italic p-1 sm:p-1.5 text-center">
                                + {detail.commits.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expandedRepo === repoWork.repo && (
              <div className="border-t-2 border-[var(--color-border)] p-3 sm:p-4 md:p-6 bg-[var(--color-bg-primary)]">
                <h4 className="text-base sm:text-lg text-[var(--color-text-primary)] mb-3 sm:mb-4 flex items-center gap-2">
                  📌 All Commits ({repoWork.commits.length})
                </h4>
                <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
                  {repoWork.commits.slice(0, 30).map((commit) => (
                    <div
                      key={commit.sha}
                      className="p-2.5 sm:p-3 md:p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-hover)] sm:hover:translate-x-1 transition-all"
                    >
                      <div className="flex gap-2 sm:gap-3 md:gap-4 mb-1.5 sm:mb-2 items-center flex-wrap">
                        <code className="font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-accent-primary)]">
                          {commit.sha}
                        </code>
                        <span className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">
                          {new Date(commit.date).toLocaleDateString("en-US")}
                        </span>
                        <span className="text-[10px] sm:text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 sm:px-2 py-0.5 rounded">
                          {commit.author}
                        </span>
                      </div>
                      <div className="text-[var(--color-text-primary)] text-xs sm:text-sm mb-2 sm:mb-3 font-medium leading-relaxed">
                        {commit.message.split("\n")[0]}
                      </div>
                      {commit.ai_summary && (
                        <div className="p-2 sm:p-2.5 md:p-3.5 bg-gradient-to-r from-[var(--color-accent-primary)]/[0.08] to-[var(--color-accent-primary)]/[0.03] border-l-2 sm:border-l-[3px] border-[var(--color-accent-primary)] rounded-md text-[10px] sm:text-xs text-[var(--color-text-secondary)] leading-relaxed mb-2 sm:mb-3">
                          🤖 {commit.ai_summary}
                        </div>
                      )}
                      <div className="flex gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs font-mono font-medium flex-wrap">
                        <span className="text-[var(--color-success)]">
                          +{commit.additions}
                        </span>
                        <span className="text-[var(--color-danger)]">
                          -{commit.deletions}
                        </span>
                        <span className="text-[var(--color-text-muted)]">
                          {commit.files_changed} files
                        </span>
                      </div>
                    </div>
                  ))}
                  {repoWork.commits.length > 30 && (
                    <div className="text-center p-3 sm:p-4 text-[var(--color-text-muted)] text-xs sm:text-sm italic bg-[var(--color-bg-tertiary)] rounded-md">
                      ... and {repoWork.commits.length - 30} more commits
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredRepoWorks.length === 0 && (
        <div className="text-center p-8 sm:p-12 md:p-16 text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg sm:rounded-xl">
          {repoWorks.length === 0 ? (
            <>
              <p className="text-base sm:text-lg font-medium text-[var(--color-text-primary)] mb-1 sm:mb-2">
                📭 No AI-analyzed commits yet.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed">
                Please fetch commits and run AI analysis.
              </p>
            </>
          ) : (
            <>
              <p className="text-base sm:text-lg font-medium text-[var(--color-text-primary)] mb-1 sm:mb-2">
                🔍 No commits found for the selected period.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed">
                Try selecting a different time range.
              </p>
            </>
          )}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === "info" ? 0 : 5000}
        />
      )}
    </div>
  );
}

export default WorkSummary;
