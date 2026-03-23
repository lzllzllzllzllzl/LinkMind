import { load } from "cheerio";

export interface ExtractedContent {
  title: string;
  content: string;
}

const EXTRACTION_FAIL_MESSAGE = "提取失败，该平台反爬较强，请手动复制正文后粘贴到输入框";
const SCRAPE_DO_TARGET_DOMAINS = ["zhihu.com", "zhuanlan.zhihu.com", "xiaohongshu.com", "xhs.cn"];
const FETCH_TIMEOUT_MS = 20000;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
];

function pickRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeText(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function getFallbackTitle(url: string) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./i, "");
    return `${domain} 的内容解读`;
  } catch {
    return "网页内容解读";
  }
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value);
}

function normalizeTitle(raw: string, fallbackUrl: string) {
  const title = normalizeText(raw);
  if (!title || looksLikeUrl(title)) {
    return getFallbackTitle(fallbackUrl);
  }
  return title;
}

function isScrapeDoTarget(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SCRAPE_DO_TARGET_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function fetchHtml(url: string, initHeaders?: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": pickRandomUserAgent(),
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...initHeaders,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`抓取失败，状态码: ${response.status}`);
    }

    const html = await response.text();
    if (!html.trim()) {
      throw new Error("抓取成功但 HTML 为空");
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}

function pickTitleFromCheerio(html: string, fallbackUrl: string) {
  const $ = load(html);
  const raw =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $('meta[itemprop="headline"]').attr("content") ||
    $("title").first().text() ||
    "";

  return normalizeTitle(raw, fallbackUrl);
}

function pickMainTextFromCheerio(html: string) {
  const $ = load(html);
  $("script, style, noscript, iframe, svg").remove();

  const candidates: string[] = [];
  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".RichText",
    ".ztext",
    ".Post-RichTextContainer",
    ".note-content",
    ".content",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeText($(element).text());
      if (text.length > 80) {
        candidates.push(text);
      }
    });
  }

  const bodyText = normalizeText($("body").text());
  if (bodyText.length > 80) {
    candidates.push(bodyText);
  }

  const best = candidates.sort((a, b) => b.length - a.length)[0] || "";
  return best.slice(0, 12000).trim();
}

function parseHtmlToContent(html: string, sourceUrl: string): ExtractedContent {
  const title = pickTitleFromCheerio(html, sourceUrl);
  const content = pickMainTextFromCheerio(html);

  if (!content) {
    throw new Error("未提取到正文内容");
  }

  return { title, content };
}

function buildScrapeDoUrl(originalUrl: string, token: string) {
  return `http://api.scrape.do/?url=${encodeURIComponent(originalUrl)}&token=${encodeURIComponent(
    token,
  )}&render_js=true&premium_proxy=true`;
}

async function extractViaDirectFetch(url: string): Promise<ExtractedContent> {
  const html = await fetchHtml(url);
  return parseHtmlToContent(html, url);
}

async function extractViaScrapeDo(url: string, token: string): Promise<ExtractedContent> {
  const scrapeDoUrl = buildScrapeDoUrl(url, token);
  const html = await fetchHtml(scrapeDoUrl);
  return parseHtmlToContent(html, url);
}

export async function extractMainContent(url: string): Promise<ExtractedContent> {
  const enableScrapeDo = false;

  if (enableScrapeDo && isScrapeDoTarget(url)) {
    const token = process.env.SCRAPE_DO_API_TOKEN?.trim();

    if (token) {
      try {
        return await extractViaScrapeDo(url, token);
      } catch (error) {
        console.error("[extractMainContent] Scrape.do 抓取失败，回退原生 fetch:", error);
      }
    } else {
      console.error("[extractMainContent] SCRAPE_DO_API_TOKEN 未配置，回退原生 fetch");
    }
  }

  try {
    return await extractViaDirectFetch(url);
  } catch (error) {
    console.error("[extractMainContent] 原生 fetch 抓取失败:", error);
    throw new Error(EXTRACTION_FAIL_MESSAGE);
  }
}