#!/usr/bin/env node
/**
 * Generates agent-readable copies of a Nextra docs site into its static export:
 *
 *   <out>/llms.txt          index of every page, grouped like the sidebar (llmstxt.org)
 *   <out>/llms-full.txt     every page concatenated into one Markdown file
 *   <out>/<path>.md         one Markdown file per page (home page → <out>/index.md)
 *   <out>/docs-index.json   pages + Markdown, searched by the Buildpad docs MCP server
 *                           (https://app.buildpad.ai/api/docs/mcp)
 *
 * The same script ships in every Buildpad docs site (buildpad-platform/docs-app,
 * buildpad-daas/docs-site, buildpad-ui/apps/docs); keep the copies identical and
 * put per-site settings in llms.config.mjs next to it.
 *
 * Page order, titles and hidden pages come from the same _meta files Nextra uses,
 * evaluated with the same environment, so the agent copy matches the sidebar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./llms.config.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(SCRIPT_DIR, config.contentDir);
const OUT_DIR = path.resolve(SCRIPT_DIR, config.outDir);
// "app": each page is <route>/page.mdx (Next app router). "content": each page is
// <route>.mdx, and a folder's own page is <folder>/index.mdx (Nextra content dir).
const LAYOUT = config.layout;

// Links in the generated files are absolute so they still work once an agent
// has copied the text somewhere else.
const BASE_URL = (process.env.DOCS_PUBLIC_URL || config.baseUrl).replace(/\/+$/, "");
const MCP_URL = "https://app.buildpad.ai/api/docs/mcp";
const PAGE_EXTENSIONS = [".mdx", ".md"];

// ---------------------------------------------------------------------------
// _meta files and frontmatter
// ---------------------------------------------------------------------------

function findFile(base, extensions) {
  for (const ext of extensions) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}

async function loadMeta(dir) {
  const file = findFile(path.join(dir, "_meta"), [".js", ".mjs", ".ts", ".tsx", ".jsx"]);
  if (!file) return {};
  // Type-only syntax is stripped by hand so .ts meta files load on any Node version.
  // A data: URL sidesteps Node's "module type not specified" warning for typeless
  // packages while still giving the file a live process.env.
  const src = fs
    .readFileSync(file, "utf8")
    .replace(/^import\s+type\s[^;]+;?\s*$/gm, "")
    .replace(/(\bconst\s+\w+)\s*:\s*[A-Za-z_$][\w$.<>,\s]*?(?=\s*=)/g, "$1")
    .replace(/\s+satisfies\s+[A-Za-z_$][\w$.<>]*/g, "");
  const mod = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
  return mod.default ?? {};
}

function parseFrontmatter(src) {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: src };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return { data, body: src.slice(match[0].length) };
}

function metaTitle(entry) {
  if (typeof entry === "string") return entry;
  return entry && typeof entry.title === "string" ? entry.title : undefined;
}

function humanize(slug) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Page discovery, in sidebar order
// ---------------------------------------------------------------------------

/** The page file for a folder's own route, if it has one. */
function folderPage(dir) {
  return LAYOUT === "app" ? findFile(path.join(dir, "page"), PAGE_EXTENSIONS) : findFile(path.join(dir, "index"), PAGE_EXTENSIONS);
}

/** The names a folder can list: sub-folders, plus page files in the "content" layout. */
function entriesOnDisk(dir) {
  const names = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name.startsWith("_") || d.name.startsWith("(") || d.name.startsWith("[")) continue;
    if (d.isDirectory()) names.push(d.name);
    else if (LAYOUT === "content" && PAGE_EXTENSIONS.includes(path.extname(d.name)) && path.parse(d.name).name !== "index") {
      names.push(path.parse(d.name).name);
    }
  }
  return [...new Set(names)].sort();
}

/**
 * Walks the content tree following each _meta file. Returns pages and external
 * links in sidebar order. `section` is the root-level separator or top-level tab
 * the entry sits under.
 */
async function collect(dir, routeParts, crumbs, state, out) {
  const meta = await loadMeta(dir);
  const keys = Object.keys(meta);
  // Anything on disk the _meta file doesn't mention still gets a page, after the listed ones.
  for (const name of entriesOnDisk(dir)) if (!keys.includes(name)) keys.push(name);
  if (!keys.includes("index") && folderPage(dir)) keys.unshift("index");

  const isRoot = routeParts.length === 0;
  for (const key of keys) {
    const entry = meta[key];
    const obj = entry && typeof entry === "object" ? entry : {};

    if (obj.type === "separator") {
      if (isRoot) state.section = obj.title || state.section;
      continue;
    }
    // A hidden home page is still the home page; other hidden entries are feature-gated.
    if (obj.display === "hidden" && !(isRoot && key === "index")) continue;
    if (typeof obj.href === "string") {
      out.links.push({ section: state.section, title: metaTitle(entry) || humanize(key), url: obj.href });
      continue;
    }

    if (key === "index") {
      const file = folderPage(dir);
      if (file) out.pages.push({ file, routeParts, crumbs, navTitle: metaTitle(entry), section: state.section });
      continue;
    }

    const title = metaTitle(entry) || humanize(key);
    // A top-level tab (type: "page") becomes a section of its own, like a separator.
    if (isRoot && obj.type === "page") state.section = title;
    const pageFile = LAYOUT === "content" ? findFile(path.join(dir, key), PAGE_EXTENSIONS) : null;
    const child = path.join(dir, key);
    const childIsDir = fs.existsSync(child) && fs.statSync(child).isDirectory();

    if (pageFile && !childIsDir) {
      out.pages.push({ file: pageFile, routeParts: [...routeParts, key], crumbs: [...crumbs, title], navTitle: title, section: state.section });
      continue;
    }
    if (!childIsDir) continue;
    // Tabs and display: "children" fold a folder into its parent without a crumb of their own.
    const ownCrumb = !(isRoot && obj.type === "page") && obj.display !== "children";
    await collect(child, [...routeParts, key], ownCrumb ? [...crumbs, title] : crumbs, state, out);
  }
}

// ---------------------------------------------------------------------------
// MDX → Markdown
// ---------------------------------------------------------------------------

const CALLOUT_LABELS = { info: "Note", warning: "Warning", error: "Important", default: "Note" };

// Backend-specific content (components/backend/backend-blocks.tsx in each site). The
// site shows one variant via a switch; agents get both, labelled, since they can't
// see the switch.
const BACKEND_LABELS = { Engine: "Buildpad Engine projects (the default)", Supabase: "Supabase projects (older)" };
const BACKEND_NOTE =
  "> **Note:** This page differs by project backend. New projects use the **Buildpad Engine**; older projects use " +
  "**Supabase**. Where they differ, both versions are given and labelled." +
  (config.backendHelpUrl ? ` To check which one a project uses, see [Project backends](${config.backendHelpUrl}).` : "");
const BACKEND_ONLY = {
  engine: "> **Note:** This page applies to **Buildpad Engine** projects only.",
  supabase: "> **Note:** This page applies to older **Supabase** projects only.",
};

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|\\{["'\`]([^"'\`]*)["'\`]\\})`));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function docsUrl(href, { markdown }) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return href;
  const [pathPart, hash = ""] = href.split("#");
  const anchor = hash ? `#${hash}` : "";
  const basePath = new URL(BASE_URL).pathname.replace(/\/+$/, "");
  const clean = (basePath ? pathPart.replace(new RegExp(`^${basePath}(?=/|$)`), "") : pathPart).replace(/\/+$/, "");
  // Static assets (screenshots, downloads) keep their own extension.
  if (/\.[A-Za-z0-9]+$/.test(clean)) return `${BASE_URL}${clean}`;
  if (!markdown) return `${BASE_URL}${clean || "/"}${anchor}`;
  return `${BASE_URL}${clean || "/index"}.md${anchor}`;
}

/** Rewrites root-relative links and drops <kbd>, outside inline code spans. */
function inline(text) {
  return text
    // Inline backend variants first: their content can contain code spans.
    .replace(/<(Engine|Supabase)(?: inline)?>(.*?)<\/\1>/g, "[$1: $2]")
    .replace(/\]\[(Engine|Supabase):/g, "] [$1:")
    .split(/(`+[^`]*`+)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/<kbd>(.*?)<\/kbd>/g, "$1")
        .replace(/(!?)\[([^\]]*)\]\((\/[^)\s]*)\)/g, (_, bang, label, href) =>
          `${bang}[${label}](${docsUrl(href, { markdown: !bang })})`,
        );
    })
    .join("");
}

/** Reads a JSX opening tag that may span several lines. Returns [tagText, nextIndex]. */
function readTag(lines, i) {
  let tag = lines[i].trim();
  let j = i;
  while (!/>\s*$/.test(tag) && j + 1 < lines.length) {
    j += 1;
    tag += " " + lines[j].trim();
  }
  return [tag, j + 1];
}

/** Inline backend variants can wrap across lines; label them before the line pass. */
function inlineVariantsAcrossLines(body) {
  const parts = body.split(/^((?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*(?:`{3,}|~{3,})\s*$)/m);
  return parts
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/<(Engine|Supabase) inline>([\s\S]*?)<\/\1>/g, (_, b, text) => `${/^\s/.test(text) ? " " : ""}[${b}: ${text.trim()}]`),
    )
    .join("");
}

function mdxToMarkdown(body) {
  const lines = inlineVariantsAcrossLines(body).split(/\r?\n/);
  const out = [];
  const quote = []; // one entry per open <Callout>
  const tabs = []; // stack of { items, next }
  let treeDepth = 0;
  let fence = null;

  const prefix = () => "> ".repeat(quote.length);
  const emit = (line) => {
    const p = prefix();
    out.push(p ? (line ? p + line : p.trimEnd()) : line);
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (fence) {
      emit(line);
      if (t.startsWith(fence) && t.slice(fence.length).trim() === "") fence = null;
      i += 1;
      continue;
    }
    const open = t.match(/^(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      emit(line);
      i += 1;
      continue;
    }

    // ESM statements at the top level (component imports, exported constants).
    if (/^(import|export)\s/.test(t) && quote.length === 0) {
      let j = i;
      while (j < lines.length && !/(from\s+['"][^'"]+['"]|^import\s+['"][^'"]+['"]);?\s*$/.test(lines[j].trim()) && !/;\s*$/.test(lines[j])) j += 1;
      i = j + 1;
      continue;
    }

    // {/* MDX comments */}
    if (/^\{\/\*/.test(t)) {
      let j = i;
      while (j < lines.length && !/\*\/\}\s*$/.test(lines[j])) j += 1;
      i = j + 1;
      continue;
    }

    if (/^<BackendNote\s*\/>$/.test(t)) {
      emit(BACKEND_NOTE);
      i += 1;
      continue;
    }
    const backend = t.match(/^<(Engine|Supabase)(?:\s[^>]*)?>$/);
    if (backend) {
      emit(`**${BACKEND_LABELS[backend[1]]}:**`);
      i += 1;
      continue;
    }
    if (/^<\/(Engine|Supabase)>$/.test(t)) {
      emit("");
      i += 1;
      continue;
    }

    if (t.startsWith("<Callout")) {
      const [tag, next] = readTag(lines, i);
      const label = CALLOUT_LABELS[attr(tag, "type") || "default"] || "Note";
      const rest = tag.replace(/^<Callout[^>]*>/, "");
      if (rest.includes("</Callout>")) {
        emit(`> **${label}:** ${inline(rest.replace("</Callout>", "").trim())}`);
      } else {
        quote.push(true);
        emit(`**${label}:**${rest.trim() ? " " + inline(rest.trim()) : ""}`);
      }
      i = next;
      continue;
    }
    if (t.startsWith("</Callout>")) {
      quote.pop();
      emit("");
      i += 1;
      continue;
    }

    if (t.startsWith("<Cards.Card")) {
      const [tag, next] = readTag(lines, i);
      const title = attr(tag, "title") || "Link";
      const href = attr(tag, "href");
      const description = attr(tag, "description");
      emit(`- [${title}](${docsUrl(href, { markdown: true })})${description ? ` — ${description}` : ""}`);
      i = next;
      continue;
    }

    if (t.startsWith("<Tabs.Tab")) {
      const current = tabs[tabs.length - 1];
      const label = current ? current.items[current.next++] : undefined;
      emit(label ? `**${label}**` : "");
      emit("");
      i += 1;
      continue;
    }
    if (t.startsWith("<Tabs")) {
      const [tag, next] = readTag(lines, i);
      const items = [...tag.matchAll(/(['"])((?:(?!\1).)*)\1/g)].map((m) => m[2]);
      tabs.push({ items, next: 0 });
      i = next;
      continue;
    }
    if (t.startsWith("</Tabs")) {
      if (t.startsWith("</Tabs>")) tabs.pop();
      emit("");
      i += 1;
      continue;
    }

    if (t.startsWith("<FileTree.Folder")) {
      const [tag, next] = readTag(lines, i);
      emit(`${"  ".repeat(treeDepth)}- ${attr(tag, "name")}/`);
      treeDepth += 1;
      i = next;
      continue;
    }
    if (t.startsWith("</FileTree.Folder")) {
      treeDepth = Math.max(0, treeDepth - 1);
      i += 1;
      continue;
    }
    if (t.startsWith("<FileTree.File")) {
      const [tag, next] = readTag(lines, i);
      emit(`${"  ".repeat(treeDepth)}- ${attr(tag, "name")}`);
      i = next;
      continue;
    }
    if (t.startsWith("<FileTree")) {
      treeDepth = 0;
      emit("");
      i += 1;
      continue;
    }
    if (t.startsWith("</FileTree")) {
      emit("");
      i += 1;
      continue;
    }

    const summary = t.match(/^<summary>(.*)<\/summary>$/);
    if (summary) {
      emit(inline(summary[1].includes("**") ? summary[1] : `**${summary[1]}**`));
      i += 1;
      continue;
    }
    if (/^<\/?(Cards|Steps|details)\b[^>]*>$/.test(t)) {
      i += 1;
      continue;
    }

    // Any other component on a line of its own is a live demo or layout wrapper:
    // keep its title and description, drop the rest. Text between its tags stays.
    if (/^<\/?[A-Z][\w.]*(\s|>|\/>|$)/.test(t)) {
      const [tag, next] = readTag(lines, i);
      if (!tag.startsWith("</")) {
        const title = attr(tag, "title");
        const description = attr(tag, "description");
        if (title) emit(`**${title}**${description ? ` — ${description}` : ""}`);
        else if (description) emit(description);
      }
      i = next;
      continue;
    }

    emit(inline(line));
    i += 1;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** First sentence of the first paragraph, for pages without a description. */
function firstSentence(markdown) {
  let fence = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (/^(`{3,}|~{3,})/.test(line)) fence = !fence;
    if (fence || !line || /^(#|>|[-*|]|\d+\.|!\[|\*\*[^*]+:\*\*$)/.test(line)) continue;
    const text = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
    const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() || text;
    return sentence.length > 200 ? sentence.slice(0, 197).trimEnd() + "…" : sentence;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function pageRecord(raw) {
  const src = fs.readFileSync(raw.file, "utf8");
  const { data, body } = parseFrontmatter(src);
  let markdown = mdxToMarkdown(body);
  const routePath = raw.routeParts.join("/");
  const title = data.title || markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || raw.navTitle || humanize(raw.routeParts.at(-1) || "Introduction");
  if (!/^#\s/.test(markdown)) markdown = `# ${title}\n\n${markdown}`;
  if (BACKEND_ONLY[data.backend]) markdown = markdown.replace(/^(#\s.+\n)/, `$1\n${BACKEND_ONLY[data.backend]}\n`);

  // Folder titles from _meta already name a nested page ("Workers › Configuration");
  // only top-level pages fall back to their own title.
  const crumbs = raw.crumbs.length ? raw.crumbs : [title];
  return {
    path: routePath,
    url: `${BASE_URL}/${routePath}${routePath ? "/" : ""}`,
    mdUrl: `${BASE_URL}/${routePath || "index"}.md`,
    title,
    breadcrumb: crumbs.join(" › "),
    section: raw.section,
    description: data.description || firstSentence(markdown.replace(/^#\s.+\n/, "")),
    markdown,
  };
}

function writeFile(rel, content) {
  const file = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`[build-llms] ${OUT_DIR} not found — run next build first`);
    process.exit(1);
  }

  const found = { pages: [], links: [] };
  await collect(CONTENT_DIR, [], [], { section: config.firstSection || "Getting Started" }, found);
  const pages = found.pages.map(pageRecord);

  for (const page of pages) writeFile(`${page.path || "index"}.md`, page.markdown);

  const sections = [];
  const bySection = new Map();
  const add = (section, line) => {
    if (!bySection.has(section)) {
      bySection.set(section, []);
      sections.push(section);
    }
    bySection.get(section).push(line);
  };
  for (const page of pages) {
    add(page.section, `- [${page.breadcrumb}](${page.mdUrl})${page.description ? `: ${page.description}` : ""}`);
  }
  for (const link of found.links) add(link.section, `- [${link.title}](${link.url}): separate documentation site`);
  for (const link of config.relatedSites || []) add("Other Buildpad Docs", `- [${link.title}](${link.url}): ${link.description}`);

  const llms = [
    `# ${config.siteTitle}`,
    "",
    `> ${config.summary}`,
    "",
    "Every page below is plain Markdown. The whole site in one file: " +
      `${BASE_URL}/llms-full.txt. AI agents can also connect to the read-only Buildpad docs MCP server ` +
      `at ${MCP_URL} (Streamable HTTP, no auth): search_docs, get_doc_page and list_doc_pages cover ` +
      "every Buildpad docs site.",
    "",
    ...sections.flatMap((section) => [`## ${section}`, "", ...bySection.get(section), ""]),
  ].join("\n");
  writeFile("llms.txt", llms);

  const full = [
    `# ${config.siteTitle}`,
    "",
    `> ${config.summary}`,
    "",
    ...pages.map((page) => `---\n\nSource: ${page.url}\n\n${page.markdown}`),
  ].join("\n");
  writeFile("llms-full.txt", full);

  writeFile(
    "docs-index.json",
    JSON.stringify({
      version: 2,
      site: config.site,
      siteTitle: config.siteTitle,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      pages,
    }),
  );

  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
  console.log(`[build-llms] ${config.site}: ${pages.length} pages → llms.txt (${kb(llms)}), llms-full.txt (${kb(full)}), per-page .md, docs-index.json`);
}

main().catch((err) => {
  console.error("[build-llms]", err);
  process.exit(1);
});
