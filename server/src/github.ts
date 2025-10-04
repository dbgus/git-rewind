import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.GITHUB_TOKEN;
const octokit = token ? new Octokit({ auth: token }) : null;

export interface GitHubRepo {
  name: string;
  fullName: string;
  private: boolean;
  language: string | null;
  updatedAt: string;
  description: string | null;
}

export const getUserRepos = async (username: string): Promise<GitHubRepo[]> => {
  if (!octokit) {
    throw new Error('GitHub token not configured');
  }

  try {
    const { data } = await octokit.repos.listForUser({
      username,
      per_page: 100,
      sort: 'updated',
    });

    return data.map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      language: repo.language || null,
      updatedAt: repo.updated_at || new Date().toISOString(),
      description: repo.description || null,
    }));
  } catch (error) {
    console.error('Failed to fetch repos:', error);
    throw error;
  }
};

export const isGitHubConfigured = (): boolean => {
  return !!token;
};
