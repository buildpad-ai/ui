// Per-site settings for build-llms.mjs (shared with the platform and DaaS docs sites).
export default {
  site: "ui",
  siteTitle: "Buildpad UI Docs",
  summary:
    "Buildpad UI is the React (Mantine) component library and CLI that Buildpad apps are built from: " +
    "collection forms and lists, field interfaces, files, users, workflows and cron modules, the app shell, " +
    "the design system and styleguide, and an MCP server for browsing and installing components.",
  baseUrl: "https://ui.buildpad.ai/docs",
  contentDir: "../content",
  layout: "content",
  outDir: "../out",
  firstSection: "Introduction",
  relatedSites: [
    { title: "Buildpad Platform Docs", url: "https://app.buildpad.ai/docs/llms.txt", description: "organizations, projects, microapps, workers, AI IDE setup" },
    { title: "Buildpad DaaS Docs", url: "https://docs.daas.buildpad.ai/llms.txt", description: "the data backend: collections, REST APIs, access control, automation" },
  ],
};
