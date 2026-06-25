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

const storybooks = [
  {
    name: "🎨 Interfaces",
    path: "/storybook/interfaces",
    port: 6005,
    description: "40+ field interface components",
  },
  {
    name: "📝 Form",
    path: "/storybook/form",
    port: 6006,
    description: "VForm dynamic form builder",
  },
  {
    name: "📊 Table",
    path: "/storybook/table",
    port: 6007,
    description: "VTable dynamic data table",
  },
  {
    name: "📦 Collections",
    path: "/storybook/collections",
    port: 6008,
    description: "CollectionForm & CollectionList",
  },
  {
    name: "📁 Files",
    path: "/storybook/files",
    port: 6009,
    description: "File upload & management components",
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

      <section className="feature-grid">
        <div className="feature-card">
          <h2>Interfaces</h2>
          <p>
            40+ Buildpad-style field components: inputs, selects, relations,
            files, maps, and workflow-aware UI.
          </p>
        </div>
        <div className="feature-card">
          <h2>VForm</h2>
          <p>
            Dynamic form builder with validation, permissions, and layout
            grouping. Built for real collections.
          </p>
        </div>
        <div className="feature-card">
          <h2>VTable</h2>
          <p>
            Sortable, resizable data grids with selection, drag ordering, and
            custom cell rendering.
          </p>
        </div>
        <div className="feature-card">
          <h2>Collections</h2>
          <p>
            CollectionForm + CollectionList compose data fetching and UI into
            production-ready CRUD.
          </p>
        </div>
        <div className="feature-card">
          <h2>Files</h2>
          <p>
            FileManager + FileDetail with upload, folders, search, bulk actions,
            metadata editing, and DaaS RBAC gating.
          </p>
        </div>
      </section>

      <section className="card" id="storybooks">
        <div className="card-header">
          <h2>Storybooks</h2>
          <span className="badge badge-gray">Live component docs</span>
        </div>

        {!status?.connected && (
          <div className="alert alert-info alert-mt">
            Connect to DaaS below to enable live data in Storybook stories.
          </div>
        )}

        <div className="storybook-grid">
          {storybooks.map((sb) => (
            <a
              key={sb.name}
              href={isDev ? `http://localhost:${sb.port}` : sb.path}
              target={isDev ? "_blank" : undefined}
              rel={isDev ? "noopener noreferrer" : undefined}
              className="storybook-card"
            >
              <h3>{sb.name}</h3>
              <p>{sb.description}</p>
              <small>{isDev ? `localhost:${sb.port}` : sb.path}</small>
            </a>
          ))}
        </div>

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
