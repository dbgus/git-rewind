import { useEffect, useState, useRef } from 'react';
import { fetchGitHubRepos, fetchGitHubStatus, fetchOrgRepos, triggerFetchCommits, fetchConfig, updateConfig, fetchJob, type GitHubRepo, type GitHubStatus, type Job } from './api';

interface RepoSelectorProps {
  onClose: () => void;
  onSelect: (repo: GitHubRepo) => void;
  onFetchComplete?: () => void;
}

function RepoSelector({ onClose, onFetchComplete }: RepoSelectorProps) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [filterAuthors, setFilterAuthors] = useState('');
  const [filterEmails, setFilterEmails] = useState('');
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(50);
  const [useAI, setUseAI] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [showOrgInput, setShowOrgInput] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    loadConfigData();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const loadConfigData = async () => {
    try {
      const config = await fetchConfig();
      if (config.filter_authors) {
        setFilterAuthors(config.filter_authors);
      }
      if (config.filter_emails) {
        setFilterEmails(config.filter_emails);
      }
      if (config.days_back) {
        setDays(config.days_back);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusData, reposData] = await Promise.all([
        fetchGitHubStatus(),
        fetchGitHubRepos(),
      ]);
      setStatus(statusData);
      setRepos(reposData);
    } catch (err) {
      setError('Failed to load repositories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleRepoSelection = (repo: GitHubRepo) => {
    setSelectedRepos(prev => {
      const isSelected = prev.some(r => r.fullName === repo.fullName);
      if (isSelected) {
        return prev.filter(r => r.fullName !== repo.fullName);
      } else {
        return [...prev, repo];
      }
    });
  };

  const selectAll = () => {
    setSelectedRepos(filteredRepos);
  };

  const deselectAll = () => {
    setSelectedRepos([]);
  };

  const loadOrgRepos = async () => {
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    try {
      setLoadingOrg(true);
      setError(null);
      const orgRepos = await fetchOrgRepos(orgName.trim());
      setRepos(prevRepos => {
        // Merge org repos with existing repos, avoiding duplicates
        const existingFullNames = new Set(prevRepos.map(r => r.fullName));
        const newRepos = orgRepos.filter(r => !existingFullNames.has(r.fullName));
        return [...prevRepos, ...newRepos];
      });
      setShowOrgInput(false);
      setOrgName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load organization repositories');
    } finally {
      setLoadingOrg(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const job = await fetchJob(jobId);
      setCurrentJob(job);

      if (job.progress !== undefined) {
        setFetchProgress({ current: job.progress, total: 100 });
      }

      if (job.status === 'completed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        const collected = job.result?.collected || 0;
        setFetchResult(`✅ Successfully collected ${collected} commits from ${selectedRepos.length} repositories`);
        setFetching(false);

        // Save config for next time
        await updateConfig({
          filter_authors: filterAuthors || null,
          filter_emails: filterEmails || null,
          days_back: days,
        });

        onFetchComplete?.();

        // 3초 후 자동으로 닫기
        setTimeout(() => {
          onClose();
        }, 3000);
      } else if (job.status === 'failed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        setError(job.error || 'Failed to fetch commits');
        setFetching(false);
      }
    } catch (err: any) {
      console.error('Failed to poll job status:', err);
    }
  };

  const handleFetch = async () => {
    if (selectedRepos.length === 0) return;

    try {
      setFetching(true);
      setError(null);
      setFetchResult(null);
      setFetchProgress({ current: 0, total: 100 });

      const since = new Date();
      since.setDate(since.getDate() - days);

      const result = await triggerFetchCommits({
        repos: selectedRepos.map(r => r.fullName),
        filterAuthors: filterAuthors ? filterAuthors.split(',').map(s => s.trim()) : undefined,
        filterEmails: filterEmails ? filterEmails.split(',').map(s => s.trim()) : undefined,
        since: since.toISOString(),
        limit,
        useAI,
      });

      // Start polling job status
      if (result.jobId) {
        const jobId = result.jobId;
        pollingIntervalRef.current = setInterval(() => {
          pollJobStatus(jobId);
        }, 1000); // Poll every second
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start fetch job');
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-4xl w-full p-8" onClick={(e) => e.stopPropagation()}>
          <div className="text-center text-[var(--color-text-secondary)]">Loading repositories...</div>
        </div>
      </div>
    );
  }

  if (error || !status?.configured) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <button className="absolute top-4 right-4 p-1 hover:bg-[var(--color-bg-hover)] rounded-md transition-colors text-xl" onClick={onClose}>
            ✕
          </button>
          <div className="p-8 text-center text-[var(--color-danger)]">
            {error || 'GitHub is not configured. Please set GITHUB_TOKEN in server/.env'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 p-1 hover:bg-[var(--color-bg-hover)] rounded-md transition-colors text-xl" onClick={onClose}>
          ✕
        </button>

        {!showConfig ? (
          <div className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-2">📦 Select Repositories</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">@{status.username}</p>

            <input
              type="text"
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] mb-4"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 mb-4">
              <button className="px-3 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md text-sm font-medium transition-colors" onClick={selectAll}>
                ✓ Select All ({filteredRepos.length})
              </button>
              <button className="px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors" onClick={deselectAll}>
                ✗ Deselect All
              </button>
              <button
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors"
                onClick={() => setShowOrgInput(!showOrgInput)}
              >
                🏢 Load from Org
              </button>
            </div>

            {showOrgInput && (
              <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg p-4 mb-4 space-y-3">
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                  placeholder="Enter organization name..."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && loadOrgRepos()}
                  disabled={loadingOrg}
                />
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors"
                    onClick={() => {
                      setShowOrgInput(false);
                      setOrgName('');
                      setError(null);
                    }}
                    disabled={loadingOrg}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={loadOrgRepos}
                    disabled={loadingOrg || !orgName.trim()}
                  >
                    {loadingOrg ? 'Loading...' : 'Load Repos'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-96 overflow-y-auto">
              {filteredRepos.length === 0 ? (
                <div className="col-span-full text-center py-8 text-[var(--color-text-secondary)]">No repositories found</div>
              ) : (
                filteredRepos.map((repo) => {
                  const isSelected = selectedRepos.some(r => r.fullName === repo.fullName);
                  return (
                    <div
                      key={repo.fullName}
                      className={`bg-[var(--color-bg-tertiary)] border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--color-accent-primary)] shadow-lg shadow-[var(--color-accent-primary)]/20'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]'
                      }`}
                      onClick={() => toggleRepoSelection(repo)}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 w-4 h-4 accent-[var(--color-accent-primary)] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-[var(--color-text-primary)] text-sm truncate">{repo.name}</span>
                            {repo.private && <span className="px-2 py-0.5 bg-[var(--color-accent-primary)] text-white text-xs rounded">Private</span>}
                            {repo.language && (
                              <span className="px-2 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs rounded">{repo.language}</span>
                            )}
                          </div>
                          {repo.description && (
                            <div className="text-xs text-[var(--color-text-secondary)] mb-2 line-clamp-2">{repo.description}</div>
                          )}
                          <div className="text-xs text-[var(--color-text-muted)]">
                            Updated: {new Date(repo.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedRepos.length > 0 && (
              <button className="w-full px-4 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-semibold transition-all shadow-lg" onClick={() => setShowConfig(true)}>
                Continue with {selectedRepos.length} {selectedRepos.length === 1 ? 'repository' : 'repositories'} →
              </button>
            )}
          </div>
        ) : showConfig ? (
          <div className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-2">⚙️ Fetch Configuration</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {selectedRepos.length} {selectedRepos.length === 1 ? 'repository' : 'repositories'} selected:{' '}
              <strong className="text-[var(--color-text-primary)]">{selectedRepos.map(r => r.name).join(', ')}</strong>
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Filter Authors (comma-separated)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                  placeholder="e.g., john,jane"
                  value={filterAuthors}
                  onChange={(e) => setFilterAuthors(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Filter Emails (comma-separated)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                  placeholder="e.g., john@example.com"
                  value={filterEmails}
                  onChange={(e) => setFilterEmails(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Days to fetch</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  min="1"
                  max="365"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Max commits per repo</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  min="1"
                  max="100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-ai"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-accent-primary)] cursor-pointer"
                />
                <label htmlFor="use-ai" className="text-sm text-[var(--color-text-primary)] cursor-pointer">
                  Use AI analysis (Mistral)
                </label>
              </div>

              {error && <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] rounded-md text-sm">{error}</div>}
              {fetchResult && <div className="p-3 bg-[var(--color-success)]/10 border border-[var(--color-success)] text-[var(--color-success)] rounded-md text-sm">{fetchResult}</div>}

              {fetching && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">
                      {currentJob?.status === 'pending' && 'Queued...'}
                      {currentJob?.status === 'processing' && `Processing commits... ${fetchProgress.current}%`}
                    </span>
                    {currentJob && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Job ID: {currentJob.id.split('_')[2]}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[var(--color-accent-primary)] h-full transition-all duration-300"
                      style={{ width: `${fetchProgress.current}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setShowConfig(false);
                    setSelectedRepos([]);
                  }}
                  disabled={fetching}
                >
                  ← Back
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  onClick={handleFetch}
                  disabled={fetching}
                >
                  {fetching ? 'Fetching...' : '🚀 Fetch Commits'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default RepoSelector;
