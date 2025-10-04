import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

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

export interface CommitDetail extends Commit {
  files: CommitFile[];
}

export interface Stats {
  total_commits: number;
  total_additions: number;
  total_deletions: number;
  total_files_changed: number;
  authors_count: number;
  repos_count: number;
}

export const fetchStats = async (): Promise<Stats> => {
  const response = await api.get<Stats>('/stats');
  return response.data;
};

export interface CommitFilters {
  search?: string;
  repo?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CommitsResponse {
  commits: Commit[];
  totalCount: number;
}

export const fetchCommits = async (
  limit = 50,
  offset = 0,
  filters?: CommitFilters
): Promise<CommitsResponse> => {
  const response = await api.get<CommitsResponse>('/commits', {
    params: { limit, offset, ...filters },
  });
  return response.data;
};

export const fetchCommitDetail = async (sha: string): Promise<CommitDetail> => {
  const response = await api.get<CommitDetail>(`/commits/${sha}`);
  return response.data;
};

export const fetchRepos = async (): Promise<{ repo: string; count: number }[]> => {
  const response = await api.get('/repos');
  return response.data;
};

export const fetchAuthors = async (): Promise<{ author: string; count: number }[]> => {
  const response = await api.get('/authors');
  return response.data;
};

export const fetchCommitsByRepo = async (repo: string, limit = 50): Promise<Commit[]> => {
  const response = await api.get(`/repos/${encodeURIComponent(repo)}/commits`, {
    params: { limit },
  });
  return response.data;
};

export const fetchCommitsByAuthor = async (author: string, limit = 50): Promise<Commit[]> => {
  const response = await api.get(`/authors/${author}/commits`, {
    params: { limit },
  });
  return response.data;
};

export interface GitHubRepo {
  name: string;
  fullName: string;
  private: boolean;
  language: string | null;
  updatedAt: string;
  description: string | null;
}

export interface GitHubStatus {
  configured: boolean;
  username: string | null;
}

export const fetchGitHubRepos = async (username?: string): Promise<GitHubRepo[]> => {
  const response = await api.get('/github/repos', {
    params: username ? { username } : {},
  });
  return response.data;
};

export const fetchOrgRepos = async (org: string): Promise<GitHubRepo[]> => {
  const response = await api.get(`/github/org/${org}/repos`);
  return response.data;
};

export const fetchGitHubStatus = async (): Promise<GitHubStatus> => {
  const response = await api.get<GitHubStatus>('/github/status');
  return response.data;
};

export interface FetchCommitsParams {
  repos: string[];
  filterAuthors?: string[];
  filterEmails?: string[];
  since?: string;
  limit?: number;
  useAI?: boolean;
}

export interface FetchCommitsResult {
  success: boolean;
  collected: number;
  jobId?: string;
  results: Array<{
    sha: string;
    repo: string;
    message: string;
    author: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    aiSummary: string | null;
  }>;
}

export const triggerFetchCommits = async (params: FetchCommitsParams): Promise<FetchCommitsResult> => {
  const response = await api.post<FetchCommitsResult>('/fetch/commits', params);
  return response.data;
};

export interface RateLimit {
  remaining: number;
  limit: number;
  resetDate: string;
}

export const fetchRateLimit = async (): Promise<RateLimit> => {
  const response = await api.get<RateLimit>('/github/rate-limit');
  return response.data;
};

// Analytics APIs
export interface DailyStats {
  date: string;
  commits: number;
  additions: number;
  deletions: number;
  files_changed: number;
}

export interface LanguageStats {
  [key: string]: string | number;
  language: string;
  commits: number;
  additions: number;
  deletions: number;
  percentage: number;
}

export interface HourlyStats {
  hour: number;
  commits: number;
}

export interface TopFile {
  filename: string;
  changes: number;
  commits: number;
}

export const fetchDailyStats = async (days = 30): Promise<DailyStats[]> => {
  const response = await api.get<DailyStats[]>('/analytics/daily', {
    params: { days },
  });
  return response.data;
};

export const fetchWeeklyStats = async (weeks = 12): Promise<DailyStats[]> => {
  const response = await api.get<DailyStats[]>('/analytics/weekly', {
    params: { weeks },
  });
  return response.data;
};

export const fetchMonthlyStats = async (months = 12): Promise<DailyStats[]> => {
  const response = await api.get<DailyStats[]>('/analytics/monthly', {
    params: { months },
  });
  return response.data;
};

export const fetchLanguageStats = async (): Promise<LanguageStats[]> => {
  const response = await api.get<LanguageStats[]>('/analytics/languages');
  return response.data;
};

export const fetchHourlyStats = async (): Promise<HourlyStats[]> => {
  const response = await api.get<HourlyStats[]>('/analytics/hourly');
  return response.data;
};

export const fetchTopFiles = async (limit = 10): Promise<TopFile[]> => {
  const response = await api.get<TopFile[]>('/analytics/top-files', {
    params: { limit },
  });
  return response.data;
};

// Config APIs
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

export const fetchConfig = async (): Promise<AppConfig> => {
  const response = await api.get<AppConfig>('/config');
  return response.data;
};

export const updateConfig = async (config: Partial<AppConfig>): Promise<AppConfig> => {
  const response = await api.put<AppConfig>('/config', config);
  return response.data;
};

export const deleteCommitsByAuthors = async (authors: string[]): Promise<{ deletedCount: number; authors: string[] }> => {
  const response = await api.delete('/commits/by-authors', {
    data: { authors },
  });
  return response.data;
};

export interface HeatmapData {
  day: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  commits: number;
}

export const fetchHeatmapData = async (days: number = 90): Promise<HeatmapData[]> => {
  const response = await api.get<HeatmapData[]>('/analytics/heatmap', {
    params: { days },
  });
  return response.data;
};

// Tag APIs
export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface TagStats {
  tag_id: number;
  tag_name: string;
  color: string;
  count: number;
}

export const fetchTags = async (): Promise<Tag[]> => {
  const response = await api.get<Tag[]>('/tags');
  return response.data;
};

export const createTag = async (name: string, color: string, description?: string): Promise<Tag> => {
  const response = await api.post<Tag>('/tags', { name, color, description });
  return response.data;
};

export const updateTag = async (id: number, name: string, color: string, description?: string): Promise<Tag> => {
  const response = await api.put<Tag>(`/tags/${id}`, { name, color, description });
  return response.data;
};

export const deleteTag = async (id: number): Promise<void> => {
  await api.delete(`/tags/${id}`);
};

export const fetchTagStats = async (): Promise<TagStats[]> => {
  const response = await api.get<TagStats[]>('/tags/stats');
  return response.data;
};

export const fetchCommitTags = async (sha: string): Promise<Tag[]> => {
  const response = await api.get<Tag[]>(`/commits/${sha}/tags`);
  return response.data;
};

export const addTagToCommit = async (sha: string, tagId: number): Promise<Tag[]> => {
  const response = await api.post<Tag[]>(`/commits/${sha}/tags/${tagId}`);
  return response.data;
};

export const removeTagFromCommit = async (sha: string, tagId: number): Promise<Tag[]> => {
  const response = await api.delete<Tag[]>(`/commits/${sha}/tags/${tagId}`);
  return response.data;
};

// Job Queue APIs
export interface Job {
  id: string;
  type: 'fetch-commits' | 'fetch-all';
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export const fetchJob = async (jobId: string): Promise<Job> => {
  const response = await api.get<Job>(`/jobs/${jobId}`);
  return response.data;
};

export const fetchAllJobs = async (): Promise<Job[]> => {
  const response = await api.get<Job[]>('/jobs');
  return response.data;
};

export const fetchQueueStats = async (): Promise<QueueStats> => {
  const response = await api.get<QueueStats>('/queue/stats');
  return response.data;
};

export const triggerFetchAll = async (): Promise<{ success: boolean; jobId: string; message: string }> => {
  const response = await api.post<{ success: boolean; jobId: string; message: string }>('/fetch/all');
  return response.data;
};
