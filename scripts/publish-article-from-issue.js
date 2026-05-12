#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://akiratarot.com";
const MANIFEST_PATH = path.join(ROOT, "content", "articles.json");
const INDEX_PATH = path.join(ROOT, "index.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");

const MARKER_START = "<!-- ARTICLE_LINKS_START -->";
const MARKER_END = "<!-- ARTICLE_LINKS_END -->";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function extractField(body, names) {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = body.match(new RegExp(`^\\s*(?:-\\s*)?(?:${escaped})\\s*[:：]\\s*(.+?)\\s*$`, "im"));
  return match ? match[1].trim() : "";
}

function cleanMetadataLines(body) {
  return body
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:-\s*)?(title|slug|description|category|keywords|date|publish date|meta title|meta description|hero title|hero intro|cta primary label|cta primary url|cta secondary label|cta secondary url|cover image)\s*[:：]/i.test(line))
    .join("\n")
    .trim();
}

function extractSection(body, headings) {
  const names = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = body.match(new RegExp(`^##\\s*(?:${names})\\s*$([\\s\\S]*?)(?=^##\\s+|\\z)`, "im"));
  return match ? match[1].trim() : "";
}

function markdownInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdownToHtml(markdown) {
  const blocks = [];
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${markdownInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push(`<ul>${list.map((item) => `<li>${markdownInline(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const tag = heading[1].length === 2 ? "h2" : "h3";
      blocks.push(`<${tag}>${markdownInline(heading[2])}</${tag}>`);
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();
  return blocks.join("\n            ");
}

function readIssue(inputPath) {
  if (!inputPath) {
    throw new Error("Usage: node scripts/publish-article-from-issue.js issue-content.json");
  }
  const issue = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  return {
    number: issue.number,
    title: issue.title || "",
    body: issue.body || "",
    url: issue.html_url || "",
  };
}

function buildArticle(issue) {
  const body = issue.body;
  const slug = slugify(extractField(body, ["Slug", "slug"]) || issue.title);
  if (!slug) throw new Error("Article slug is required.");

  const href = `${slug}.html`;
  if (href.includes("/") || href.includes("\\")) throw new Error("Invalid slug.");

  const displayTitle = extractField(body, ["Title", "title"]) || issue.title;
  const metaTitle = extractField(body, ["Meta title", "meta title"]) || `${displayTitle} | AKIRA TAROT`;
  const description =
    extractField(body, ["Description", "Meta description", "description", "meta description"]) ||
    "AKIRA TAROT article by Yoyo: tarot guidance, intuitive reflection, and practical next steps.";
  const category = extractField(body, ["Category", "category"]) || "Tarot guide";
  const publishDate = extractField(body, ["Date", "Publish date", "date", "publish date"]) || today();
  const heroTitle = extractField(body, ["Hero title", "hero title"]) || displayTitle;
  const heroIntro =
    extractField(body, ["Hero intro", "hero intro"]) ||
    "这篇文章整理了 Yoyo 的塔罗视角，帮助你更清晰地理解问题、能量与下一步选择。";
  const ctaPrimaryLabel = extractField(body, ["CTA primary label"]) || "预约咨询";
  const ctaPrimaryUrl = extractField(body, ["CTA primary url"]) || "index.html#booking";
  const ctaSecondaryLabel = extractField(body, ["CTA secondary label"]) || "阅读塔罗101";
  const ctaSecondaryUrl = extractField(body, ["CTA secondary url"]) || "tarot-101.html";
  const coverImage = extractField(body, ["Cover image", "cover image"]) || "";

  const chinese = extractSection(body, ["中文正文", "Chinese", "Chinese Content", "正文"]);
  const english = extractSection(body, ["English Summary", "English", "英文摘要"]);
  const fallback = cleanMetadataLines(body);
  const mainContent = chinese || fallback;

  return {
    slug,
    href,
    title: displayTitle,
    metaTitle,
    description,
    category,
    publishDate,
    heroTitle,
    heroIntro,
    ctaPrimaryLabel,
    ctaPrimaryUrl,
    ctaSecondaryLabel,
    ctaSecondaryUrl,
    coverImage,
    mainHtml: markdownToHtml(mainContent),
    englishHtml: english ? markdownToHtml(english) : "",
    issue,
  };
}

function renderArticlePage(article) {
  const cover = article.coverImage
    ? `<section class="content-band">
        <img class="article-image" src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}" />
      </section>`
    : "";
  const english = article.englishHtml
    ? `<section class="content-band muted-band">
        <div class="section-intro">
          <p class="eyebrow">English summary</p>
          <h2>Quick takeaways</h2>
        </div>
        <div class="bio-essay short">
          ${article.englishHtml}
        </div>
      </section>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(article.metaTitle)}</title>
    <meta name="description" content="${escapeHtml(article.description)}" />
    <link rel="stylesheet" href="styles.css" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-1RH16YD3JB"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag("js", new Date());
      gtag("config", "G-1RH16YD3JB");
    </script>
  </head>
  <body class="subpage reading-page article-page">
    <header class="site-header" aria-label="Primary navigation">
      <a class="brand" href="index.html" aria-label="AKIRA TAROT home">
        <span class="brand-mark" aria-hidden="true"></span>
        🔮 AKIRA TAROT
      </a>
      <div class="header-actions">
        <nav>
          <a href="index.html#readings">服务</a>
          <a href="about.html">关于</a>
          <a href="tarot-101.html">塔罗101</a>
          <a href="shop.html">商店</a>
          <a href="index.html#booking">预约</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="subpage-hero reading-hero">
        <div class="breadcrumb" aria-label="Breadcrumb">
          <a href="index.html">AKIRA TAROT</a>
          <span>/</span>
          <span>${escapeHtml(article.category)}</span>
        </div>
        <p class="eyebrow">${escapeHtml(article.category)}</p>
        <h1>${escapeHtml(article.heroTitle)}</h1>
        <p>${escapeHtml(article.heroIntro)}</p>
        <div class="hero-actions">
          <a class="button primary" href="${escapeHtml(article.ctaPrimaryUrl)}">
            <span class="icon send" aria-hidden="true"></span>
            <span>${escapeHtml(article.ctaPrimaryLabel)}</span>
          </a>
          <a class="button secondary" href="${escapeHtml(article.ctaSecondaryUrl)}">
            <span class="icon book" aria-hidden="true"></span>
            <span>${escapeHtml(article.ctaSecondaryLabel)}</span>
          </a>
        </div>
      </section>

      ${cover}

      <section class="content-band">
        <div class="bio-essay short">
          ${article.mainHtml}
        </div>
      </section>

      ${english}

      <section class="page-cta">
        <p class="eyebrow">Book a reading</p>
        <h2>想把这个问题带进一次更具体的塔罗咨询？</h2>
        <p>你可以预约 Yoyo 的 1:1 塔罗咨询，把问题背景、关系状态或事业选择讲清楚，再一起看牌面给出的提示。</p>
        <div class="hero-actions">
          <a class="button primary" href="index.html#booking">
            <span class="icon send" aria-hidden="true"></span>
            <span>预约咨询</span>
          </a>
          <a class="button secondary" href="shop.html">
            <span class="icon bag" aria-hidden="true"></span>
            <span>查看商店</span>
          </a>
        </div>
      </section>
    </main>

    <footer>
      <p>🔮 AKIRA TAROT 🌟 晶晶塔罗</p>
      <div>
        <a href="about.html">关于</a>
        <a href="tarot-101.html">塔罗101</a>
        <a href="shop.html">商店</a>
        <a href="index.html#booking">预约</a>
      </div>
    </footer>
  </body>
</html>
`;
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(articles) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(articles, null, 2)}\n`);
}

function updateManifest(article) {
  const articles = readManifest();
  const withoutCurrent = articles.filter((item) => item.href !== article.href);
  withoutCurrent.unshift({
    title: article.title,
    href: article.href,
    description: article.description,
    date: article.publishDate,
    issue: article.issue.number || undefined,
  });
  writeManifest(withoutCurrent);
  return withoutCurrent;
}

function renderArticleLinks(articles) {
  const top = articles.slice(0, 10);
  const rest = articles.slice(10);
  const link = (item) => `          <a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`;
  const hidden = rest.length
    ? `        <details class="more-articles">
          <summary>查看更多文章</summary>
          <div class="topic-link-strip">
${rest.map(link).join("\n")}
          </div>
        </details>`
    : "";

  return `${MARKER_START}
        <div class="topic-link-strip">
${top.map(link).join("\n")}
        </div>
${hidden}
        ${MARKER_END}`;
}

function updateIndex(articles) {
  const index = fs.readFileSync(INDEX_PATH, "utf8");
  const replacement = renderArticleLinks(articles);

  if (index.includes(MARKER_START) && index.includes(MARKER_END)) {
    const pattern = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`);
    fs.writeFileSync(INDEX_PATH, index.replace(pattern, replacement));
    return;
  }

  const sectionPattern = /<div class="topic-link-strip">[\s\S]*?<details class="more-articles">[\s\S]*?<\/details>/;
  if (!sectionPattern.test(index)) {
    throw new Error("Could not find homepage article links section.");
  }
  fs.writeFileSync(INDEX_PATH, index.replace(sectionPattern, replacement));
}

function updateSitemap(article) {
  const sitemap = fs.readFileSync(SITEMAP_PATH, "utf8");
  const loc = `${SITE_URL}/${article.href}`;
  const entry = `  <url>
    <loc>${loc}</loc>
    <lastmod>${article.publishDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

  if (sitemap.includes(`<loc>${loc}</loc>`)) {
    const pattern = new RegExp(`  <url>\\n    <loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>\\n    <lastmod>[^<]+</lastmod>\\n    <changefreq>[^<]+</changefreq>\\n    <priority>[^<]+</priority>\\n  </url>`);
    fs.writeFileSync(SITEMAP_PATH, sitemap.replace(pattern, entry));
    return;
  }

  fs.writeFileSync(SITEMAP_PATH, sitemap.replace("</urlset>", `${entry}\n</urlset>`));
}

function main() {
  const issue = readIssue(process.argv[2]);
  const article = buildArticle(issue);
  fs.writeFileSync(path.join(ROOT, article.href), renderArticlePage(article));
  const articles = updateManifest(article);
  updateIndex(articles);
  updateSitemap(article);
  console.log(`Published ${article.href}`);
}

main();
