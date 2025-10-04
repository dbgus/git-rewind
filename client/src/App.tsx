import { useEffect, useState, useRef } from "react";
import {
  fetchStats,
  fetchCommits,
  fetchRepos,
  fetchAuthors,
  triggerFetchAll,
  fetchJob,
  fetchConfig,
  updateConfig,
  type Commit,
  type Stats,
  type GitHubRepo,
  type CommitFilters,
  type Job,
} from "./api";
import { format } from "date-fns";
import RepoSelector from "./RepoSelector";
import Charts from "./Charts";
import Settings from "./Settings";
import WorkSummary from "./WorkSummary";
import TagManager from "./TagManager";
import CommitTags from "./CommitTags";
import Toast from "./components/Toast";
import WelcomeModal from "./components/WelcomeModal";
import { useTheme } from "./ThemeContext";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [repos, setRepos] = useState<{ repo: string; count: number }[]>([]);
  const [authors, setAuthors] = useState<{ author: string; count: number }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [currentTab, setCurrentTab] = useState<
    "commits" | "analytics" | "summary" | "tags" | "settings"
  >("commits");
  const [hasMoreData, setHasMoreData] = useState(true);
  const [filteredTotalCount, setFilteredTotalCount] = useState(0);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchAllJob, setFetchAllJob] = useState<Job | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string>("all");
  const [selectedAuthor, setSelectedAuthor] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
    checkWelcomeModal();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const checkWelcomeModal = async () => {
    try {
      const config = await fetchConfig();
      if (!config.modal_dismissed) {
        setShowWelcomeModal(true);
      }
    } catch (error) {
      console.error("Failed to check welcome modal status:", error);
    }
  };

  const handleCloseWelcomeModal = async () => {
    try {
      await updateConfig({ modal_dismissed: true });
      setShowWelcomeModal(false);
    } catch (error) {
      console.error("Failed to update modal dismissed status:", error);
      setShowWelcomeModal(false);
    }
  };

  // 탭 변경 시 데이터 새로고침
  useEffect(() => {
    if (currentTab === "commits") {
      loadData();
    }
  }, [currentTab]);

  const getFilters = (): CommitFilters => ({
    search: searchTerm || undefined,
    repo: selectedRepo !== "all" ? selectedRepo : undefined,
    author: selectedAuthor !== "all" ? selectedAuthor : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const filters = getFilters();
      const [statsData, commitsResponse, reposData, authorsData] =
        await Promise.all([
          fetchStats(),
          fetchCommits(50, 0, filters),
          fetchRepos(),
          fetchAuthors(),
        ]);
      setStats(statsData);
      setCommits(commitsResponse.commits);
      setFilteredTotalCount(commitsResponse.totalCount);
      setRepos(reposData);
      setAuthors(authorsData);
      setHasMoreData(commitsResponse.commits.length === 50);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCommits = async () => {
    try {
      setLoading(true);
      const offset = commits.length;
      const filters = getFilters();
      const commitsResponse = await fetchCommits(50, offset, filters);
      if (commitsResponse.commits.length > 0) {
        setCommits((prev) => [...prev, ...commitsResponse.commits]);
        setHasMoreData(commitsResponse.commits.length === 50);
      } else {
        setHasMoreData(false);
      }
    } catch (error) {
      console.error("Failed to load more commits:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRepoSelect = (repo: GitHubRepo) => {
    console.log("Selected repo:", repo);
  };

  const handleFetchComplete = () => {
    loadData();
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    setCommits([]);
    loadData();
  };

  // 페이지네이션
  const totalPages = Math.ceil(commits.length / itemsPerPage);
  const paginatedCommits = commits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    const nextPage = currentPage + 1;
    const needsMoreData = nextPage * itemsPerPage > commits.length;

    if (needsMoreData && hasMoreData) {
      loadMoreCommits().then(() => {
        setCurrentPage(nextPage);
      });
    } else {
      setCurrentPage(nextPage);
    }
  };

  // 필터링된 커밋 수
  const maxPossiblePages = Math.ceil(filteredTotalCount / itemsPerPage);

  // 필터 초기화
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedRepo("all");
    setSelectedAuthor("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    setCommits([]);
    loadData();
  };

  const pollFetchAllJob = async (jobId: string) => {
    try {
      const job = await fetchJob(jobId);
      setFetchAllJob(job);

      if (job.status === "completed") {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setFetchingAll(false);

        const collected = job.result?.collected || 0;
        setToast({
          message: `✅ Successfully collected ${collected} commits from all repositories!`,
          type: "success",
        });

        loadData(); // Reload data after completion
      } else if (job.status === "failed") {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setFetchingAll(false);

        setToast({
          message: `❌ Failed to fetch commits: ${
            job.error || "Unknown error"
          }`,
          type: "error",
        });
      }
    } catch (error: any) {
      console.error("Failed to poll job status:", error);
    }
  };

  const handleFetchAll = async () => {
    try {
      setFetchingAll(true);
      setFetchAllJob(null);

      const result = await triggerFetchAll();

      // Show toast message
      setToast({
        message:
          "🚀 Fetching all commits from your repositories... This may take a few minutes. Please check back shortly!",
        type: "info",
      });

      // Start polling job status
      if (result.jobId) {
        pollingIntervalRef.current = setInterval(() => {
          pollFetchAllJob(result.jobId);
        }, 1000);
      }
    } catch (error: any) {
      console.error("Failed to start fetch-all:", error);
      setFetchingAll(false);

      setToast({
        message: "❌ Failed to start fetching commits. Please try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-50 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Header - only on large screens */}
          <div className="hidden lg:flex items-center justify-between gap-4 px-4 sm:px-6 py-4">
            <h1 className="text-2xl xl:text-3xl font-bold">🚀 GitHub rewind</h1>
            <div className="flex items-center gap-3">
              <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1 gap-1">
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentTab === "commits"
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setCurrentTab("commits")}
                >
                  📝 Commits
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentTab === "analytics"
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setCurrentTab("analytics")}
                >
                  📊 Analytics
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentTab === "summary"
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setCurrentTab("summary")}
                >
                  📋 Summary
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentTab === "tags"
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setCurrentTab("tags")}
                >
                  🏷️ Tags
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentTab === "settings"
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => setCurrentTab("settings")}
                >
                  ⚙️ Settings
                </button>
              </div>
              <button
                className="p-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors text-xl"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === "dark" ? "🌞" : "🌙"}
              </button>
              <button
                className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleFetchAll}
                disabled={fetchingAll}
                title="Fetch all commits from all repositories"
              >
                {fetchingAll ? "⏳ Fetching..." : "📥 Get All"}
              </button>
              <button
                className="px-4 py-2 rounded-md bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white font-medium transition-colors whitespace-nowrap"
                onClick={() => setShowRepoSelector(true)}
              >
                ➕ Fetch New
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-lg sm:text-xl font-bold">🚀 Dashboard</h1>
              <div className="flex gap-2">
                <button
                  className="p-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors text-xl"
                  onClick={toggleTheme}
                  title="Toggle theme"
                >
                  {theme === "dark" ? "🌞" : "🌙"}
                </button>
                <button
                  className="px-2 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleFetchAll}
                  disabled={fetchingAll}
                  title="Get all"
                >
                  {fetchingAll ? "⏳" : "📥"}
                </button>
                <button
                  className="px-3 py-2 rounded-md bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white font-medium transition-colors text-sm"
                  onClick={() => setShowRepoSelector(true)}
                >
                  ➕ Fetch
                </button>
              </div>
            </div>

            {/* Fetch All Progress Bar */}
            {fetchingAll && fetchAllJob && (
              <div className="px-4 pb-2">
                <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--color-text-secondary)]">
                      {fetchAllJob.status === "pending" && "Queued..."}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-bg-primary)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${fetchAllJob.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mobile/Tablet Tabs */}
            <div className="grid grid-cols-5 gap-1 px-2 pb-2">
              <button
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-colors ${
                  currentTab === "commits"
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                }`}
                onClick={() => setCurrentTab("commits")}
              >
                <span className="text-2xl mb-1">📝</span>
                <span>Commits</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-colors ${
                  currentTab === "analytics"
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                }`}
                onClick={() => setCurrentTab("analytics")}
              >
                <span className="text-2xl mb-1">📊</span>
                <span>Analytics</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-colors ${
                  currentTab === "summary"
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                }`}
                onClick={() => setCurrentTab("summary")}
              >
                <span className="text-2xl mb-1">📋</span>
                <span>Summary</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-colors ${
                  currentTab === "tags"
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                }`}
                onClick={() => setCurrentTab("tags")}
              >
                <span className="text-2xl mb-1">🏷️</span>
                <span>Tags</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-medium transition-colors ${
                  currentTab === "settings"
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                }`}
                onClick={() => setCurrentTab("settings")}
              >
                <span className="text-2xl mb-1">⚙️</span>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {currentTab === "commits" && (
        <>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 p-4 sm:p-6 max-w-7xl mx-auto">
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Total Commits
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                  {stats.total_commits.toLocaleString()}
                </div>
              </div>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Additions
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[var(--color-success)]">
                  {(stats.total_additions ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Deletions
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[var(--color-danger)]">
                  -{(stats.total_deletions ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Files Changed
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                  {(stats.total_files_changed ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Repositories
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                  {stats.repos_count}
                </div>
              </div>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-2">
                  Authors
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                  {stats.authors_count}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">
                  🔍 Search & Filters
                </h3>

                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] mb-3"
                  placeholder="Search commits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleFilterChange()}
                />

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Repository
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                    >
                      <option value="all">All Repositories</option>
                      {repos.map((repo) => (
                        <option key={repo.repo} value={repo.repo}>
                          {repo.repo} ({repo.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Author
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                      value={selectedAuthor}
                      onChange={(e) => setSelectedAuthor(e.target.value)}
                    >
                      <option value="all">All Authors</option>
                      {authors.map((author) => (
                        <option key={author.author} value={author.author}>
                          {author.author} ({author.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>

                  <button
                    className="w-full px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md text-sm font-medium transition-colors"
                    onClick={handleFilterChange}
                  >
                    🔍 Apply Filters
                  </button>

                  <button
                    className="w-full px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors"
                    onClick={resetFilters}
                  >
                    🔄 Reset Filters
                  </button>
                </div>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">📦 Repositories</h3>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {repos.map((repo) => (
                    <div
                      key={repo.repo}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedRepo(repo.repo);
                        setCurrentPage(1);
                      }}
                    >
                      <span className="text-sm truncate">{repo.repo}</span>
                      <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                        {repo.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">👤 Authors</h3>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {authors.map((author) => (
                    <div
                      key={author.author}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedAuthor(author.author);
                        setCurrentPage(1);
                      }}
                    >
                      <span className="text-sm truncate">{author.author}</span>
                      <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                        {author.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h2 className="text-xl font-semibold">Commits</h2>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-sm hover:bg-[var(--color-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Page {currentPage} of{" "}
                      {maxPossiblePages > 0 ? maxPossiblePages : "?"}
                    </span>
                    <button
                      className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-sm hover:bg-[var(--color-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={loading}
                      onClick={handleNextPage}
                    >
                      {loading ? "Loading..." : "Next →"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {paginatedCommits.map((commit) => (
                  <div
                    key={commit.sha}
                    className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent-primary)] cursor-pointer transition-all"
                    onClick={() => setSelectedCommit(commit)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <code className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
                        {commit.sha}
                      </code>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {format(new Date(commit.date), "yyyy-MM-dd HH:mm")}
                      </span>
                    </div>
                    <div className="text-sm font-medium mb-3 break-words">
                      {commit.message.split("\n")[0]}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)] mb-2">
                      <span className="flex items-center gap-1">
                        👤 {commit.author}
                      </span>
                      <span className="flex items-center gap-1">
                        📦 {commit.repo}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-success)]">
                          +{commit.additions}
                        </span>
                        {" / "}
                        <span className="text-[var(--color-danger)]">
                          -{commit.deletions}
                        </span>
                        {" / "}
                        {commit.files_changed} files
                      </span>
                    </div>
                    <CommitTags commitSha={commit.sha} />
                    {commit.ai_summary && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                        🤖 {commit.ai_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {currentTab === "analytics" && <Charts />}

      {currentTab === "summary" && <WorkSummary />}

      {currentTab === "tags" && <TagManager />}

      {currentTab === "settings" && <Settings />}

      {selectedCommit && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCommit(null)}
        >
          <div
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Commit Details</h2>
              <button
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
                onClick={() => setSelectedCommit(null)}
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  SHA:
                </strong>
                <code className="block mt-1 text-xs bg-[var(--color-bg-tertiary)] px-3 py-2 rounded break-all">
                  {selectedCommit.full_sha}
                </code>
              </div>
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  Message:
                </strong>
                <p className="mt-1 whitespace-pre-wrap">
                  {selectedCommit.message}
                </p>
              </div>
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  Author:
                </strong>
                <p className="mt-1">
                  {selectedCommit.author} ({selectedCommit.author_email})
                </p>
              </div>
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  Date:
                </strong>
                <p className="mt-1">
                  {format(new Date(selectedCommit.date), "PPpp")}
                </p>
              </div>
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  Repository:
                </strong>
                <p className="mt-1">{selectedCommit.repo}</p>
              </div>
              <div>
                <strong className="text-sm text-[var(--color-text-secondary)]">
                  Changes:
                </strong>
                <p className="mt-1">
                  <span className="text-[var(--color-success)]">
                    +{selectedCommit.additions}
                  </span>
                  {" / "}
                  <span className="text-[var(--color-danger)]">
                    -{selectedCommit.deletions}
                  </span>
                  {" / "}
                  {selectedCommit.files_changed} files
                </p>
              </div>
              {selectedCommit.ai_summary && (
                <div className="border-t border-[var(--color-border)] pt-4">
                  <strong className="text-sm text-[var(--color-text-secondary)]">
                    🤖 AI Analysis:
                  </strong>
                  <p className="mt-1 text-sm">{selectedCommit.ai_summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRepoSelector && (
        <RepoSelector
          onClose={() => setShowRepoSelector(false)}
          onSelect={handleRepoSelect}
          onFetchComplete={handleFetchComplete}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showWelcomeModal && (
        <WelcomeModal onClose={handleCloseWelcomeModal} />
      )}
    </div>
  );
}

export default App;
