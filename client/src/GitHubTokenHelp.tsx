interface GitHubTokenHelpProps {
  onClose: () => void;
}

export default function GitHubTokenHelp({ onClose }: GitHubTokenHelpProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            🔑 How to Get GitHub Personal Access Token
          </h2>
          <button
            className="p-1 hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#4b5563 #1f2937",
          }}
        >
          <div className="p-6 space-y-6">
            {/* Introduction */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                A GitHub Personal Access Token is required to fetch commit data
                from the GitHub API. Follow the steps below to generate your
                token.
              </p>
            </div>

            {/* Step 1 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold">
                  1
                </div>
                <h3 className="text-lg font-semibold">Go to GitHub Settings</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  After logging into GitHub, navigate to the following link or
                  follow the path below:
                </p>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md text-sm transition-colors"
                >
                  🔗 Open GitHub Token Settings
                </a>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Or: GitHub Profile → Settings → Developer settings → Personal
                  access tokens → Tokens (classic)
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold">
                  2
                </div>
                <h3 className="text-lg font-semibold">Generate New Token</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Click "Generate new token" button and select "Generate new
                  token (classic)".
                </p>
                <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    💡 Tip
                  </p>
                  <p className="text-sm">
                    We recommend using <strong>Classic tokens</strong> instead
                    of Fine-grained tokens.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold">
                  3
                </div>
                <h3 className="text-lg font-semibold">Configure Token</h3>
              </div>
              <div className="ml-10 space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Note (Token Name)</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Enter a descriptive name for your token. Example: "GitHub
                    Commit Dashboard"
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Expiration</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Select the expiration period for your token (30 days, 60
                    days, 90 days, or no expiration)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">
                    Select scopes (Permissions)
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    Check the following permissions:
                  </p>
                  <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked
                        disabled
                        className="mt-1"
                      />
                      <div>
                        <code className="text-xs bg-[var(--color-bg-primary)] px-2 py-1 rounded">
                          repo
                        </code>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Full repository access (read commit data from
                          public/private repositories)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked
                        disabled
                        className="mt-1"
                      />
                      <div>
                        <code className="text-xs bg-[var(--color-bg-primary)] px-2 py-1 rounded">
                          read:user
                        </code>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Read user profile information
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold">
                  4
                </div>
                <h3 className="text-lg font-semibold">Copy and Save Token</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Click the "Generate token" button to create your token.
                </p>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">
                    ⚠️ Important!
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    The generated token will be shown <strong>only once</strong>
                    . Make sure to copy it to a safe place. You won't be able to
                    see it again after leaving the page!
                  </p>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Token format:{" "}
                  <code className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
                    ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  </code>
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white font-bold">
                  5
                </div>
                <h3 className="text-lg font-semibold">
                  Enter Token in Settings
                </h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Go to the Settings tab in this dashboard, paste your token
                  into the "GitHub Personal Access Token" field, and save.
                </p>
              </div>
            </div>

            {/* Security Tips */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <h3 className="text-lg font-semibold mb-3">
                🔒 Security Best Practices
              </h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    Never commit tokens to public repositories or include them
                    directly in your code.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    If your token is exposed, immediately delete it on GitHub
                    and generate a new one.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Only grant the minimum permissions necessary.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    This app runs locally only, and your token is securely
                    stored in your browser's local database.
                  </span>
                </li>
              </ul>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white rounded-md transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
