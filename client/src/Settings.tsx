import { useEffect, useState, useRef } from 'react';
import { fetchConfig, updateConfig, deleteCommitsByAuthors, fetchAuthors, triggerFetchAll, fetchJob, type AppConfig, type Job } from './api';
import GitHubTokenHelp from './GitHubTokenHelp';

function Settings() {
  const [config, setConfig] = useState<AppConfig>({
    github_token: '',
    github_username: '',
    mistral_api_key: '',
    filter_authors: '',
    filter_emails: '',
    days_back: null,
    blacklist_authors: '',
    modal_dismissed: false,
  });
  const [authors, setAuthors] = useState<{ author: string; count: number }[]>([]);
  const [showAuthorList, setShowAuthorList] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchAllJob, setFetchAllJob] = useState<Job | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadConfig();
    loadAuthors();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await fetchConfig();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadAuthors = async () => {
    try {
      const data = await fetchAuthors();
      setAuthors(data);
    } catch (error) {
      console.error('Failed to load authors:', error);
    }
  };

  const handleSave = async () => {
    // 블랙리스트가 변경되었는지 확인
    const currentBlacklist = config.blacklist_authors || '';
    const hasBlacklist = currentBlacklist.trim().length > 0;

    if (hasBlacklist) {
      const confirmed = window.confirm(
        '⚠️ Blacklist Authors Settings\n\n' +
        '• Existing commits from blacklisted authors will be DELETED from the database\n' +
        '• Future fetches will skip these authors\n' +
        '• To restore: Remove from blacklist and fetch from GitHub again\n\n' +
        'Do you want to continue?'
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setSaving(true);
      setMessage(null);
      await updateConfig(config);

      // 블랙리스트가 있으면 자동으로 삭제
      if (hasBlacklist) {
        const authors = getBlacklistedAuthors();
        if (authors.length > 0) {
          const result = await deleteCommitsByAuthors(authors);
          setMessage({
            type: 'success',
            text: `Settings saved! Deleted ${result.deletedCount} commits from ${authors.length} blacklisted author(s).`,
          });
          loadAuthors(); // 작성자 목록 새로고침
        } else {
          setMessage({ type: 'success', text: 'Settings saved successfully!' });
        }
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      }

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof AppConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: value === '' ? null : value,
    }));
  };

  const getBlacklistedAuthors = (): string[] => {
    if (!config.blacklist_authors) return [];
    return config.blacklist_authors.split(',').map(a => a.trim()).filter(a => a);
  };

  const toggleAuthor = (authorName: string) => {
    const blacklisted = getBlacklistedAuthors();
    const index = blacklisted.indexOf(authorName);

    if (index > -1) {
      blacklisted.splice(index, 1);
    } else {
      blacklisted.push(authorName);
    }

    handleChange('blacklist_authors', blacklisted.join(','));
  };

  const pollFetchAllJob = async (jobId: string) => {
    try {
      const job = await fetchJob(jobId);
      setFetchAllJob(job);

      if (job.status === 'completed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        const collected = job.result?.collected || 0;
        const totalRepos = job.result?.totalRepos || 0;
        setMessage({
          type: 'success',
          text: `✅ Successfully collected ${collected} commits from ${totalRepos} repositories!`,
        });
        setFetchingAll(false);
      } else if (job.status === 'failed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        setMessage({
          type: 'error',
          text: job.error || 'Failed to fetch all commits',
        });
        setFetchingAll(false);
      }
    } catch (error: any) {
      console.error('Failed to poll job status:', error);
    }
  };

  const handleFetchAll = async () => {
    const confirmed = window.confirm(
      '⚠️ This will fetch ALL commits from ALL your GitHub repositories.\n\n' +
      'This operation may take several minutes and will consume GitHub API rate limit.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      setFetchingAll(true);
      setMessage(null);
      setFetchAllJob(null);

      const result = await triggerFetchAll();

      // Start polling job status
      if (result.jobId) {
        pollingIntervalRef.current = setInterval(() => {
          pollFetchAllJob(result.jobId);
        }, 1000);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to start fetch-all job',
      });
      setFetchingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="text-center text-[var(--color-text-secondary)]">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-2">⚙️ Settings</h2>
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Configure your GitHub token, API keys, and default filter settings
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-[var(--color-success)]/10 border-[var(--color-success)] text-[var(--color-success)]'
            : 'bg-[var(--color-danger)]/10 border-[var(--color-danger)] text-[var(--color-danger)]'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-4">🔑 API Keys</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                GitHub Personal Access Token
                <span className="text-[var(--color-danger)] ml-1">*</span>
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.github_token || ''}
                onChange={(e) => handleChange('github_token', e.target.value)}
                placeholder="ghp_..."
              />
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <small className="text-xs text-[var(--color-text-secondary)] flex-1">
                  Generate at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-primary)] hover:underline">GitHub Settings</a>
                  {' '}(Requires: repo, read:user)
                </small>
                <button
                  type="button"
                  onClick={() => setShowTokenHelp(true)}
                  className="text-xs px-3 py-1 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md transition-colors self-start"
                >
                  📖 How to get token
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Mistral AI API Key</label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.mistral_api_key || ''}
                onChange={(e) => handleChange('mistral_api_key', e.target.value)}
                placeholder="Optional - for AI commit analysis"
              />
              <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
                Get your key at <a href="https://console.mistral.ai/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-primary)] hover:underline">Mistral Console</a>
              </small>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-4">👤 GitHub Configuration</h3>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">GitHub Username</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
              value={config.github_username || ''}
              onChange={(e) => handleChange('github_username', e.target.value)}
              placeholder="your-username"
            />
            <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
              Used for fetching your repositories
            </small>
          </div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-4">🔍 Default Filters</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Filter Authors</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.filter_authors || ''}
                onChange={(e) => handleChange('filter_authors', e.target.value)}
                placeholder="author1,author2,author3"
              />
              <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
                Comma-separated list of authors to filter (leave empty for all)
              </small>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Filter Emails</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.filter_emails || ''}
                onChange={(e) => handleChange('filter_emails', e.target.value)}
                placeholder="email1@example.com,email2@example.com"
              />
              <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
                Comma-separated list of emails to filter (leave empty for all)
              </small>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Days Back</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.days_back || ''}
                onChange={(e) => handleChange('days_back', e.target.value)}
                placeholder="Leave empty for all commits"
                min="1"
              />
              <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
                Number of days to fetch commits from (leave empty for all history)
              </small>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-4">🚫 Blacklist Authors</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Blacklist Authors
                <span className="ml-2 px-2 py-0.5 bg-[var(--color-danger)]/20 text-[var(--color-danger)] text-xs font-semibold rounded">Danger Zone</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] text-[var(--color-text-primary)]"
                value={config.blacklist_authors || ''}
                onChange={(e) => handleChange('blacklist_authors', e.target.value)}
                placeholder="author1,author2,author3"
              />
              <small className="block mt-1 text-xs text-[var(--color-text-secondary)]">
                Comma-separated list of author names to exclude from fetching.
                <br />
                ⚠️ Saving will automatically delete existing commits from blacklisted authors.
              </small>
            </div>

            {authors.length > 0 && (
              <div>
                <button
                  className="px-4 py-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium transition-colors border border-[var(--color-border)] mb-3"
                  onClick={() => setShowAuthorList(!showAuthorList)}
                >
                  {showAuthorList ? '📋 Hide Author List' : '📋 Select from Authors'}
                </button>

                {showAuthorList && (
                  <div className="space-y-3">
                    <small className="block text-xs text-[var(--color-text-secondary)]">
                      Click to toggle blacklist (showing all {authors.length} authors). Blacklisted authors will be removed when you save.
                    </small>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {authors.map((author) => {
                        const isBlacklisted = getBlacklistedAuthors().includes(author.author);
                        return (
                          <div
                            key={author.author}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              isBlacklisted
                                ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)] hover:bg-[var(--color-danger)]/20'
                                : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-hover)]'
                            }`}
                            onClick={() => toggleAuthor(author.author)}
                          >
                            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold ${
                              isBlacklisted
                                ? 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'
                                : 'border-[var(--color-border)]'
                            }`}>
                              {isBlacklisted ? '✓' : ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{author.author}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">{author.count} commits</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg">
              <small className="block text-xs text-[var(--color-text-secondary)] leading-relaxed">
                ℹ️ <strong className="text-[var(--color-text-primary)]">How it works:</strong>
                <br />
                • Saving settings will delete existing commits from blacklisted authors
                <br />
                • Future GitHub fetches will skip these authors
                <br />
                • To restore: Remove from blacklist, save, then fetch from GitHub again
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          className="px-4 py-2 rounded-md bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSave}
          disabled={saving || !config.github_token}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
        <button
          className="px-4 py-2 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium transition-colors border border-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={loadConfig}
          disabled={saving}
        >
          🔄 Reset
        </button>
      </div>

      {/* Fetch All Button */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">🚀 Bulk Operations</h3>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            Fetch ALL commits from ALL your GitHub repositories at once. This will use the filter settings above.
          </p>
          {fetchingAll && fetchAllJob && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  {fetchAllJob.status === 'pending' && 'Queued...'}
                  {fetchAllJob.status === 'processing' && `Fetching repositories... ${fetchAllJob.progress || 0}%`}
                </span>
                {fetchAllJob && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Job ID: {fetchAllJob.id.split('_')[2]}
                  </span>
                )}
              </div>
              <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--color-accent-primary)] h-full transition-all duration-300"
                  style={{ width: `${fetchAllJob.progress || 0}%` }}
                />
              </div>
            </div>
          )}
          <button
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleFetchAll}
            disabled={fetchingAll || !config.github_token}
          >
            {fetchingAll ? '⏳ Fetching All...' : '📥 Get All from GitHub'}
          </button>
        </div>
      </div>

      {showTokenHelp && <GitHubTokenHelp onClose={() => setShowTokenHelp(false)} />}
    </div>
  );
}

export default Settings;
