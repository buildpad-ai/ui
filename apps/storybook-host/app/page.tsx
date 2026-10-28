"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";

interface ConnectionStatus {
  connected: boolean;
  url: string | null;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    admin_access: boolean;
    status: string;
  } | null;
  error?: string;
}

interface CatalogItem {
  emoji: string;
  name: string;
  path: string;
  port: number;
  blurb: string;
}

interface CatalogTier {
  tier: string;
  caption: string;
  items: CatalogItem[];
}

// Single source of truth for the catalog, grouped by altitude so the two
// form-related entries (VForm the renderer vs. the Form Builder authoring
// module) read as distinct things. Mirrors the layers in /docs/architecture.
const catalog: CatalogTier[] = [
  {
    tier: "Field Interfaces",
    caption: "Schema-mapped primitives",
    items: [
      {
        emoji: "🎨",
        name: "Interfaces",
        path: "/storybook/interfaces",
        port: 6005,
        blurb: "40+ field components: inputs, selects, relations, files, maps.",
      },
    ],
  },
  {
    tier: "Renderers",
    caption: "Schema → UI",
    items: [
      {
        emoji: "📝",
        name: "VForm",
        path: "/storybook/form",
        port: 6006,
        blurb: "Schema-driven form renderer — validation, permissions, layout.",
      },
      {
        emoji: "📊",
        name: "VTable",
        path: "/storybook/table",
        port: 6007,
        blurb: "Dynamic data table — sorting, selection, drag-ordering.",
      },
    ],
  },
  {
    tier: "Composition",
    caption: "Data + UI",
    items: [
      {
        emoji: "📦",
        name: "Collections",
        path: "/storybook/collections",
        port: 6008,
        blurb: "CollectionForm + CollectionList — production-ready CRUD.",
      },
    ],
  },
  {
    tier: "App Modules",
    caption: "Full features with docs recipes",
    items: [
      {
        emoji: "📁",
        name: "Files",
        path: "/storybook/files",
        port: 6009,
        blurb:
          "FileManager + FileDetail — upload, folders, preview, bulk actions.",
      },
      {
        emoji: "🧩",
        name: "Form Builder",
        path: "/storybook/forms",
        port: 6010,
        blurb: "Design forms visually; render them live with DynamicForm.",
      },
      {
        emoji: "🛡️",
        name: "Users",
        path: "/storybook/users",
        port: 6011,
        blurb:
          "Users, roles & policies admin — RBAC management with a permissions matrix.",
      },
      {
        emoji: "🔀",
        name: "Workflows",
        path: "/storybook/workflows",
        port: 6013,
        blurb:
          "Workflow definitions with a state diagram editor, assignments & instances.",
      },
      {
        emoji: "⏱️",
        name: "Cron Jobs",
        path: "/storybook/cron",
        port: 6014,
        blurb:
          "Cron jobs list with row actions, the job editor & run history with logs.",
      },
    ],
  },
];

const GITHUB_URL = "https://github.com/buildpad-ai/ui";

const pillars = [
  {
    title: "Copy & Own",
    body: "The CLI copies component source into your app. Read it, change it, ship it — no black boxes.",
  },
  {
    title: "Schema aware",
    body: "Forms, tables and field interfaces render straight from DaaS collection metadata and permissions.",
  },
  {
    title: "Agent ready",
    body: "An MCP server and CLI let coding agents discover, add and wire components for you.",
  },
];

// The BuildPad mark (same artwork as public/buildpad-mark.svg and the docs favicon).
function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 68 67"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M50.657 0H33.5578C31.4988 0 29.8291 1.66677 29.8291 3.72222V23.0135C29.8291 24.001 30.222 24.9473 30.9209 25.6459L43.6513 38.3541C44.3502 39.0518 44.743 39.999 44.743 40.9865V63.2778C44.743 65.3332 46.4127 67 48.4717 67H63.3865C65.4456 67 67.1152 65.3332 67.1152 63.2778V16.4305C67.1152 15.443 66.7224 14.4967 66.0235 13.7981L53.294 1.08988C52.5951 0.392181 51.6462 0 50.657 0Z"
        fill="#FD7E14"
      />
      <path
        d="M18.6435 0H3.7287C1.66967 0 0 1.66677 0 3.72222V50.5686C0 51.5561 0.392864 52.5024 1.09178 53.201L13.8222 65.9092C14.5211 66.6069 15.4699 66.9991 16.4591 66.9991H33.5583C35.6173 66.9991 37.287 65.3324 37.287 63.2769V44.0688C37.287 43.0813 36.8941 42.135 36.1952 41.4364L23.4649 28.7282C22.7659 28.0305 22.3731 27.0833 22.3731 26.0958V3.72222C22.3731 1.66677 20.7034 0 18.6444 0H18.6435Z"
        fill="#FD9843"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);
  // Connecting is optional (stories run on mock data), so the form stays
  // collapsed behind a compact status bar until the user opts in.
  const [showConnect, setShowConnect] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // When the form is revealed (via the bar button), focus the first field. `preventScroll` keeps the #connect anchor's scroll from
  // fighting the focus-induced scroll.
  useEffect(() => {
    if (showConnect) urlInputRef.current?.focus({ preventScroll: true });
  }, [showConnect]);

  useEffect(() => {
    setIsDev(window.location.hostname === "localhost");
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
      if (data.url) setUrl(data.url);
    } catch {
      setStatus({ connected: false, url: null, user: null });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!url || !token) return;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || `Connection failed (${res.status})`);
        return;
      }

      await checkStatus();
      setToken(""); // Clear token from UI after successful connect
      setShowConnect(false); // Collapse the form back to the compact bar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/disconnect", { method: "POST" });
      setStatus({ connected: false, url: null, user: null });
      setToken("");
      setError(null);
    } catch {
      // Ignore
    }
  };

  return (
    <>
      <header className="site-nav">
        <div className="container site-nav-inner">
          <a className="brand" href="/" aria-label="Buildpad UI home">
            <BrandMark />
            <span className="brand-word">buildpad</span>
            <span className="brand-tag">UI</span>
          </a>
          <nav className="site-nav-links" aria-label="Primary">
            <a href="/docs">Docs</a>
            <a href="/docs/styleguide">Styleguide</a>
            <a href="#storybooks">Storybooks</a>
          </nav>
          <a
            className="btn btn-ghost btn-sm github-link"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
      </header>

      <main>
        <section className="hero-band">
          <div className="container hero">
            <div className="hero-content">
              <span className="hero-badge">
                <span className="hero-badge-dot" aria-hidden />
                Reusable UI Library
              </span>
              <h1 className="hero-title">
                Buildpad UI <span className="hero-accent">Packages</span>.
              </h1>
              <p className="hero-subtitle">
                A Copy &amp; Own component system for data-heavy apps. Build
                with Mantine, powered by Buildpad-style schema, and ship
                Storybooks that connect to real DaaS data.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="/docs">
                  Documentation
                </a>
                <a className="btn btn-ghost" href="#storybooks">
                  Explore Storybooks
                </a>
                <a
                  className="btn btn-ghost"
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHubIcon />
                  View on GitHub
                </a>
              </div>
              <div className="hero-meta">
                <span>40+ field interfaces</span>
                <span>VForm + VTable</span>
                <span>MCP + CLI tooling</span>
              </div>
            </div>
            <div className="hero-panel">
              <div className="code-card">
                <div className="code-title">Quick Start</div>
                <pre>{`npx @buildpad/cli@latest init
npx @buildpad/cli@latest add collection-form
npx @buildpad/cli@latest bootstrap`}</pre>
                <div className="code-foot">
                  Add components to any Next.js project.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="container landing">
          <section className="pillars" aria-label="Why Buildpad UI">
            {pillars.map((p) => (
              <div key={p.title} className="pillar">
                <span className="pillar-mark" aria-hidden />
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
            ))}
          </section>

          <section className="connect-card" id="connect">
            {loading ? (
              <div className="connect-bar">
                <div className="loading">
                  <span className="loading-spinner" />
                  Checking connection…
                </div>
              </div>
            ) : status?.connected && status.user ? (
              // Compact connected bar — no heavy panel.
              <div className="connect-bar">
                <div className="connect-bar-status">
                  <span className="status-dot is-on" aria-hidden />
                  <div className="connect-bar-text">
                    <strong>
                      Connected as {status.user.first_name}{" "}
                      {status.user.last_name}
                      {status.user.admin_access && (
                        <span className="badge badge-admin connect-admin">
                          Admin
                        </span>
                      )}
                    </strong>
                    <span>{status.url}</span>
                  </div>
                </div>
                <div className="connect-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={checkStatus}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              // Compact optional prompt — the form is revealed only on demand.
              <>
                <div className="connect-bar">
                  <div className="connect-bar-status">
                    <span className="status-dot" aria-hidden />
                    <div className="connect-bar-text">
                      <strong>Live data is optional</strong>
                      <span>
                        Stories run on mock data. Connect a DaaS instance to use
                        real data.
                      </span>
                    </div>
                  </div>
                  <div className="connect-actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        showConnect ? "btn-outline" : "btn-primary"
                      }`}
                      onClick={() => setShowConnect((v) => !v)}
                      aria-expanded={showConnect ? "true" : "false"}
                    >
                      {showConnect ? "Cancel" : "Connect DaaS"}
                    </button>
                  </div>
                </div>

                {showConnect && (
                  <div className="connect-form-wrap">
                    <div className="alert alert-info alert-mt">
                      The host app acts as an authentication proxy so Storybooks
                      can use real DaaS data without CORS issues.
                    </div>

                    {status?.error && (
                      <div className="alert alert-warning">
                        {status.connected ? "Connected but auth error: " : ""}
                        {status.error}
                      </div>
                    )}

                    <form onSubmit={handleConnect}>
                      <div className="form-group">
                        <label htmlFor="daas-url">DaaS URL</label>
                        <input
                          id="daas-url"
                          ref={urlInputRef}
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://xxx.buildpad-daas.xtremax.com"
                          aria-describedby="daas-url-help"
                          required
                        />
                        <small id="daas-url-help">
                          Must be an https:// URL on an allowed DaaS host (e.g.
                          *.buildpad-daas.xtremax.com).
                        </small>
                      </div>

                      <div className="form-group">
                        <label htmlFor="daas-token">Static Token</label>
                        <input
                          id="daas-token"
                          type="password"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          placeholder="Your DaaS static token"
                          required
                        />
                        <small>
                          Generate from DaaS → Users → Edit User → Token →
                          Generate Token
                        </small>
                      </div>

                      {error && (
                        <div className="alert alert-error">{error}</div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={connecting || !url || !token}
                      >
                        {connecting ? "Connecting…" : "Connect"}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card" id="storybooks">
            <div className="card-header">
              <h2>Storybooks</h2>
              <a className="badge badge-gray" href="/docs">
                Live component docs
              </a>
            </div>

            {catalog.map((group, i) => (
              <div key={group.tier} className="tier">
                <div className="tier-head">
                  <span className="tier-index" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="tier-label">{group.tier}</h3>
                  <span className="tier-caption">{group.caption}</span>
                </div>
                <div className="storybook-grid">
                  {group.items.map((sb) => (
                    <a
                      key={sb.name}
                      href={isDev ? `http://localhost:${sb.port}` : sb.path}
                      target={isDev ? "_blank" : undefined}
                      rel={isDev ? "noopener noreferrer" : undefined}
                      className="storybook-card"
                    >
                      <div className="storybook-card-head">
                        <span className="storybook-icon" aria-hidden>
                          {sb.emoji}
                        </span>
                        <h3>{sb.name}</h3>
                        <span className="storybook-arrow" aria-hidden>
                          →
                        </span>
                      </div>
                      <p>{sb.blurb}</p>
                      <small>{isDev ? `localhost:${sb.port}` : sb.path}</small>
                    </a>
                  ))}
                </div>
              </div>
            ))}

            {isDev && (
              <div className="dev-note">
                <strong>Local Development</strong>
                <p className="dev-note-text">
                  Start the host app first, then run Storybooks. They proxy{" "}
                  <code>/api/*</code> to this app automatically.
                </p>
                <pre>{`pnpm dev:host               # Start this proxy (port 3000)
pnpm storybook:interfaces   # Port 6005
pnpm storybook:form         # Port 6006
pnpm storybook:forms        # Port 6010 (form builder)
pnpm storybook:table        # Port 6007
pnpm storybook:collections  # Port 6008
pnpm storybook:files        # Port 6009
pnpm storybook:users        # Port 6011 (users/roles/policies)
pnpm storybook:workflows    # Port 6013 (workflow definitions/assignments/instances)
pnpm storybook:cron         # Port 6014 (cron jobs/editor/run history)`}</pre>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <a className="brand brand-sm" href="/" aria-label="Buildpad UI home">
            <BrandMark size={20} />
            <span className="brand-word">buildpad</span>
            <span className="brand-tag">UI</span>
          </a>
          <nav className="site-footer-links" aria-label="Footer">
            <a href="/docs">Documentation</a>
            <a href="/docs/styleguide">Styleguide</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a
              href="https://www.buildpad.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              buildpad.ai
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
