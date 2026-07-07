"use client";

import { useState, useEffect, type FormEvent } from "react";

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
        blurb: "FileManager + FileDetail — upload, folders, preview, bulk actions.",
      },
      {
        emoji: "🧩",
        name: "Form Builder",
        path: "/storybook/forms",
        port: 6010,
        blurb: "Design forms visually; render them live with DynamicForm.",
      },
    ],
  },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);

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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Connection failed");
        return;
      }

      await checkStatus();
      setToken(""); // Clear token from UI after successful connect
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

  if (loading) {
    return (
      <main className="landing">
        <div className="loading">
          <span className="loading-spinner" />
          Checking connection…
        </div>
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Reusable UI Library</span>
          <h1 className="hero-title">Buildpad UI Packages</h1>
          <p className="hero-subtitle">
            A Copy &amp; Own component system for data-heavy apps. Build with
            Mantine, powered by Buildpad-style schema, and ship Storybooks that
            connect to real DaaS data.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/docs">
              Documentation
            </a>
            <a className="btn btn-ghost" href="#storybooks">
              Explore Storybooks
            </a>
            <a className="btn btn-ghost" href="#connect">
              Connect DaaS
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
            <div className="code-foot">Add components to any Next.js project.</div>
          </div>
          <div className="signal-strip">
            <div>
              <strong>Copy &amp; Own</strong>
              <span>Ship source, not black boxes.</span>
            </div>
            <div>
              <strong>Schema aware</strong>
              <span>Auto-render fields from DaaS metadata.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card" id="storybooks">
        <div className="card-header">
          <h2>Storybooks</h2>
          <a className="badge badge-gray" href="/docs">
            Live component docs
          </a>
        </div>

        {!status?.connected && (
          <div className="alert alert-info alert-mt">
            Connect to DaaS below to enable live data in Storybook stories.
          </div>
        )}

        {catalog.map((group) => (
          <div key={group.tier} className="tier">
            <div className="tier-head">
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
                  <h3>
                    {sb.emoji} {sb.name}
                  </h3>
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
pnpm storybook:files        # Port 6009`}</pre>
          </div>
        )}
      </section>

      <section className="card" id="connect">
        <div className="card-header">
          <h2>DaaS Connection</h2>
          <span
            className={`badge ${
              status?.connected ? "badge-green" : "badge-gray"
            }`}
          >
            {status?.connected ? "● Connected" : "○ Not Connected"}
          </span>
        </div>

        <div className="alert alert-info alert-mt">
          The host app acts as an authentication proxy so Storybooks can use
          real DaaS data without CORS issues.
        </div>

        {status?.connected && status.user ? (
          <div className="user-info">
            <div className="user-row">
              <span className="user-name">
                {status.user.first_name} {status.user.last_name}
              </span>
              {status.user.admin_access && (
                <span className="badge badge-admin">Admin</span>
              )}
            </div>
            <span className="user-email">{status.user.email}</span>
            <span className="user-url">{status.url}</span>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={checkStatus}
              >
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect}>
            {status?.connected && status.error && (
              <div className="alert alert-warning">
                Connected but auth error: {status.error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="daas-url">DaaS URL</label>
              <input
                id="daas-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxx.buildpad-daas.xtremax.com"
                required
              />
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
                Generate from DaaS → Users → Edit User → Token → Generate Token
              </small>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={connecting || !url || !token}
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
