export default function TestingPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">Docs</a> / Testing
      </div>
      <h1 className="docs-title">Testing Guide</h1>
      <p className="docs-lead">
        Buildpad uses Playwright for E2E testing with a two-tier strategy:
        Storybook component tests and DaaS integration tests.
      </p>

      <h2 className="docs-heading" id="storybook-tests">
        Storybook Component Tests
      </h2>
      <p className="docs-paragraph">
        Storybook tests are isolated, fast, and require no authentication. They
        test components with mocked data covering all interface types.
      </p>
      <div className="docs-code-block">
        <div className="docs-code-title">Terminal</div>
        <pre className="docs-pre">{`# Terminal 1: Start Storybook
pnpm storybook:interfaces.   # Interfaces on port 6005
pnpm storybook:form          # VForm on port 6006
pnpm storybook:table         # VTable on port 6007
pnpm storybook:collections   # Collections on port 6008

# Terminal 2: Run tests
pnpm test:storybook          # Run VForm Storybook tests
pnpm test:storybook:table    # Run VTable Storybook tests`}</pre>
      </div>

      <h2 className="docs-heading" id="daas-tests">
        DaaS E2E Tests
      </h2>
      <p className="docs-paragraph">
        Full integration tests against a real DaaS backend with authentication,
        permissions, and data seeding.
      </p>
      <div className="docs-code-block">
        <div className="docs-code-title">Terminal</div>
        <pre className="docs-pre">{`# Prerequisites:
# 1. Configure .env.local with DaaS credentials
# 2. Install Playwright browsers
pnpm exec playwright install chromium

# Run E2E tests
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui`}</pre>
      </div>

      <h2 className="docs-heading" id="daas-playground">
        DaaS Playground
      </h2>
      <p className="docs-paragraph">
        All Storybooks include a DaaS Playground story for live-data testing.
        The playground uses the storybook-host app as an authentication proxy to
        avoid CORS issues.
      </p>
      <div className="docs-code-block">
        <div className="docs-code-title">Terminal</div>
        <pre className="docs-pre">{`# Terminal 1: Start host app (auth proxy)
pnpm dev:host

# Terminal 2: Start Storybook
pnpm storybook:form`}</pre>
      </div>
      <p className="docs-paragraph">
        Open <code>http://localhost:3000</code>, enter your DaaS URL and token
        to connect, then use Storybook with real data.
      </p>

      <h2 className="docs-heading" id="test-organization">
        Test Organization
      </h2>
      <div className="docs-code-block">
        <div className="docs-code-title">Test structure</div>
        <pre className="docs-pre">{`tests/
├── auth.setup.ts               # Auth setup (runs once)
├── helpers/
│   └── seed-test-data.ts       # Test data seeding
├── ui-form/
│   ├── vform-storybook.spec.ts # Storybook component tests
│   ├── vform-daas.spec.ts      # DaaS integration tests
│   └── vform.spec.ts           # Full E2E workflow tests
└── ui-table/
    └── vtable-storybook.spec.ts # VTable tests (22 tests)

playwright.config.ts            # 4 projects: setup, chromium, storybook, storybook-table`}</pre>
      </div>

      <div className="docs-footer-nav">
        <a href="/docs/components" className="docs-footer-link">
          ← Component Map
        </a>
        <div />
      </div>
    </>
  );
}
