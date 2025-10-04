interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-2xl font-bold">🚀 Welcome to GitHub Rewind!</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* 서비스 목표 */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🎯 What is GitHub Rewind?
            </h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              GitHub Rewind helps you track, analyze, and visualize your GitHub commit history.
              Get insights into your coding patterns, productivity trends, and contribution metrics
              across all your repositories in one place.
            </p>
          </section>

          {/* 작동 방식 */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              ⚙️ How It Works
            </h3>
            <div className="space-y-3 text-[var(--color-text-secondary)]">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent-primary)] text-white flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Configure Settings</strong>
                  <p className="text-sm mt-1">
                    Go to Settings and add your GitHub token to connect your repositories.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent-primary)] text-white flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Fetch Your Commits</strong>
                  <p className="text-sm mt-1">
                    Use "Get All" to fetch all your commits, or "Fetch New" to select specific repositories.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent-primary)] text-white flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <div>
                  <strong className="text-[var(--color-text-primary)]">Explore & Analyze</strong>
                  <p className="text-sm mt-1">
                    Browse your commits, view analytics, create summaries, and organize with tags.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 주요 기능 */}
          <section>
            <h3 className="text-lg font-semibold mb-3">✨ Key Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                <div className="text-lg mb-1">📊 Analytics</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Visualize your coding activity with charts and heatmaps
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                <div className="text-lg mb-1">🤖 AI Summaries</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Get AI-powered insights on your commits
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                <div className="text-lg mb-1">🏷️ Tags</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Organize commits with custom tags
                </div>
              </div>

              <div className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                <div className="text-lg mb-1">🔍 Smart Filters</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Search and filter by repo, author, or date
                </div>
              </div>
            </div>
          </section>

          {/* CTA 버튼 */}
          <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
            <button
              className="px-6 py-2.5 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg font-medium transition-colors"
              onClick={onClose}
            >
              Get Started 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
