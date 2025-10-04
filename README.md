# GitHub Commit Fetcher

A full-stack web application for collecting and analyzing GitHub commit history. Visualize personal and team commit activities with AI-powered commit analysis, tag management, and detailed statistical dashboards.

## Features

- **Commit Collection & Storage**: Fetch commit data from multiple repositories via GitHub API and store in SQLite DB
- **AI Commit Analysis**: Automatic commit content analysis and summarization using Mistral AI
- **Real-time Dashboard**: React-based web UI for visualizing commit activities
- **Detailed Statistics**: Daily/weekly/monthly stats, language analysis, activity heatmaps
- **Tag System**: Add custom tags to commits for classification and management
- **Job Queue**: Background job queue for processing large-scale commit collection
- **Filtering**: Filter commits by author, email, and date range
- **Blacklist**: Exclude commits from specific authors
- **Dark Mode**: Light/dark theme support

## Tech Stack

### Backend
- **Node.js + TypeScript**: Server logic
- **Express**: REST API server
- **better-sqlite3**: Data storage (SQLite)
- **Octokit**: GitHub API client
- **Mistral AI**: Commit content analysis

### Frontend
- **React 19 + TypeScript**: UI framework
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **Recharts**: Data visualization
- **Axios**: HTTP client

## Project Structure

```
github-commit-fetcher/
├── server/                 # Backend (Express API)
│   └── src/
│       ├── index.ts       # API server main
│       ├── config.ts      # Configuration management
│       ├── db.ts          # Database logic
│       ├── fetcher.ts     # GitHub commit fetcher
│       ├── github.ts      # GitHub API client
│       ├── analytics.ts   # Statistical analysis
│       ├── tags.ts        # Tag management
│       ├── queue.ts       # Job queue
│       └── scheduler.ts   # Scheduler
├── client/                # Frontend (React)
│   └── src/
│       ├── App.tsx        # Main app
│       ├── Charts.tsx     # Chart components
│       ├── Settings.tsx   # Settings page
│       ├── TagManager.tsx # Tag management
│       └── components/    # Reusable components
├── data/                  # SQLite database
├── index.js              # CLI script (full fetch)
└── .env                  # Environment variables
```

## Quick Start with Docker Compose (Recommended)

The easiest way to get started:

```bash
# 1. Clone the repository
git clone <repository-url>
cd github-commit-fetcher

# 2. Build and start services
docker compose up --build

# 3. Open in browser
# Client: http://localhost:5173
# Server: http://localhost:3001
```

That's it! The application will start with both frontend and backend services.

### Environment Configuration (Optional)

Create a `.env` file in the root directory if you want to pre-configure settings:

```env
# GitHub Personal Access Token
GITHUB_TOKEN=ghp_your_token_here

# GitHub username
GITHUB_USERNAME=your-username

# Mistral AI API Key (optional)
MISTRAL_API_KEY=your_mistral_key_here
```

Otherwise, you can configure these settings through the web UI after startup.

### Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose up --build
```

---

## Manual Installation & Setup

If you prefer to run without Docker:

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**.env Configuration**:

```env
# GitHub Personal Access Token
# Generate at https://github.com/settings/tokens
# Required scopes: repo (including all sub-scopes), read:user
GITHUB_TOKEN=ghp_your_token_here

# GitHub username
GITHUB_USERNAME=your-username

# Repositories to fetch (owner/repo format, comma-separated)
REPOS=owner/repo1,owner/repo2

# Filter by authors (optional)
FILTER_AUTHORS=

# Mistral AI API Key (optional - for AI analysis feature)
# Get it from https://console.mistral.ai/api-keys
MISTRAL_API_KEY=
```

### 3. Generate GitHub Token

1. Visit https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` (all sub-scopes)
   - ✅ `read:user`
4. Copy the generated token to `.env` file

### 4. Run Server

```bash
cd server
npm run dev
```

Server runs at http://localhost:3001

### 5. Run Client

In a new terminal:

```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

### Collect Commits via Web UI

1. Open http://localhost:5173 in browser
2. Initial setup modal appears on first run
3. Enter GitHub Token and username
4. Click "Fetch Commits" to start collection
5. View collected commits in the dashboard

### Full Commit Collection via CLI

For bulk commit collection:

```bash
# From root directory
npm start
```

### Main API Endpoints

- `GET /api/commits` - List commits (with pagination & filtering)
- `GET /api/commits/:sha` - Get commit details
- `POST /api/fetch/commits` - Start commit collection job
- `GET /api/stats` - Overall statistics
- `GET /api/analytics/*` - Various analytics data
- `GET /api/tags` - List tags
- `GET /api/config` - Get configuration
- `PUT /api/config` - Update configuration

See `server/src/index.ts` for complete API documentation.

## Feature Details

### Commit Collection

- Collect from multiple repositories simultaneously
- Filter by time period (default: last 30 days)
- Filter by author/email
- Exclude blacklisted authors
- Automatically skip duplicate commits
- Process via background job queue

### AI Commit Analysis

Using Mistral AI:
- Automatic commit summarization
- Change analysis
- Importance evaluation

### Statistics & Analytics

- **Daily/Weekly/Monthly Stats**: Commit counts, code changes
- **Language Stats**: Analysis based on file extensions
- **Hourly Activity**: Most active hours of the day
- **Heatmap**: Activity pattern visualization
- **Top Files**: Most frequently modified files
- **Author Analytics**: Individual team member activity

### Tag Management

- Create custom tags (with colors and descriptions)
- Add/remove tags to commits
- Filter commits by tags
- Tag-based statistics

## Development

### Server Development

```bash
cd server
npm run dev  # Auto-restart with tsx watch
```

### Client Development

```bash
cd client
npm run dev  # Vite HMR enabled
```

### Build

```bash
# Build server
cd server
npm run build

# Build client
cd client
npm run build
```

## Database Schema

SQLite database stored at `data/commits.db` with tables:

- `commits`: Commit information
- `commit_files`: Files changed in commits
- `config`: Application configuration
- `tags`: Custom tags
- `commit_tags`: Commit-tag relationships

## Limitations

- **GitHub API Rate Limit**:
  - Authenticated requests: 5,000 per hour
  - Unauthenticated requests: 60 per hour
- **Bulk Collection**: Be cautious of rate limits when fetching hundreds of repositories
- **AI Analysis**: Mistral API usage may incur costs

## Troubleshooting

### Rate Limit Exceeded

```bash
# Check rate limit
curl http://localhost:3001/api/github/rate-limit
```

### Reset Database

```bash
rm data/commits.db
# Restart server to auto-create tables
```

### Check Logs

View real-time logs in the server terminal.

## Contributing

Issues and PRs are welcome!

## License

ISC
