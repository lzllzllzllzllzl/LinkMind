import { load } from "cheerio";

export interface ExtractedContent {
  title: string;
  content: string;
}

const SCRAPE_DO_TARGET_DOMAINS = ["zhihu.com", "zhuanlan.zhihu.com", "xiaohongshu.com", "xhs.cn"];
const FETCH_TIMEOUT_MS = 20000;
const MIN_CONTENT_LENGTH = 120;

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
      redirect: "follow",
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

async function fetchHtmlWithStrategies(url: string) {
  const headerStrategies: Array<Record<string, string> | undefined> = [
    undefined,
    {
      Referer: url,
      "Upgrade-Insecure-Requests": "1",
    },
    {
      Referer: "https://www.google.com/",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
    },
  ];

  for (const headers of headerStrategies) {
    try {
      return await fetchHtml(url, headers);
    } catch {
      // 继续尝试下一组请求头
    }
  }

  throw new Error("抓取失败");
}

function pickTitleFromCheerio(html: string, fallbackUrl: string) {
  const $ = load(html);
  const raw =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $('meta[itemprop="headline"]').attr("content") ||
    $("h1").first().text() ||
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
    ".article",
    "[class*='article']",
    "[class*='content']",
    "[class*='post']",
    "[id*='content']",
    ".markdown-body",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeText($(element).text());
      if (text.length > 80) {
        candidates.push(text);
      }
    });
  }

  const paragraphText = normalizeText(
    $("p")
      .map((_, element) => $(element).text())
      .get()
      .join("\n"),
  );
  if (paragraphText.length > 80) {
    candidates.push(paragraphText);
  }

  const bodyText = normalizeText($("body").text());
  if (bodyText.length > 80) {
    candidates.push(bodyText);
  }

  const best = candidates.sort((a, b) => b.length - a.length)[0] || "";
  return best.slice(0, 12000).trim();
}

function pickFallbackTextFromMeta(html: string, sourceUrl: string) {
  const $ = load(html);
  const metaDescription =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  const heading = $("h1").first().text() || $("h2").first().text() || "";

  const paragraph = $("p")
    .map((_, element) => normalizeText($(element).text()))
    .get()
    .filter((item) => item.length > 10)
    .slice(0, 8)
    .join("\n");

  const fallback = [metaDescription, heading, paragraph]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join("\n\n");

  if (fallback.length >= 40) {
    return fallback.slice(0, 12000);
  }

  return `页面可访问，但正文提取有限。来源：${sourceUrl}`;
}

function parseHtmlToContent(html: string, sourceUrl: string): ExtractedContent {
  const title = pickTitleFromCheerio(html, sourceUrl);
  let content = pickMainTextFromCheerio(html);

  if (content.length < MIN_CONTENT_LENGTH) {
    const fallbackText = pickFallbackTextFromMeta(html, sourceUrl);
    if (fallbackText.length > content.length) {
      content = fallbackText;
    }
  }

  if (!content.trim()) {
    content = `页面可访问，但正文提取有限。来源：${sourceUrl}`;
  }

  return { title, content: content.slice(0, 12000).trim() };
}

function buildScrapeDoUrl(originalUrl: string, token: string) {
  return `https://api.scrape.do/?url=${encodeURIComponent(originalUrl)}&token=${encodeURIComponent(
    token,
  )}&render_js=true&premium_proxy=true`;
}

async function extractViaDirectFetch(url: string): Promise<ExtractedContent> {
  const html = await fetchHtmlWithStrategies(url);
  return parseHtmlToContent(html, url);
}

async function extractViaScrapeDo(url: string, token: string): Promise<ExtractedContent> {
  const scrapeDoUrl = buildScrapeDoUrl(url, token);
  const html = await fetchHtmlWithStrategies(scrapeDoUrl);
  return parseHtmlToContent(html, url);
}

export async function extractMainContent(url: string): Promise<ExtractedContent> {
  const token = process.env.SCRAPE_DO_API_TOKEN?.trim();

  if (token && isScrapeDoTarget(url)) {
    try {
      return await extractViaScrapeDo(url, token);
    } catch (error) {
      console.error("[extractMainContent] Scrape.do 抓取失败，回退原生 fetch:", error);
    }
  }

  try {
    return await extractViaDirectFetch(url);
  } catch (error) {
    console.error("[extractMainContent] 原生抓取失败，返回降级内容:", error);
    return {
      title: getFallbackTitle(url),
      content: `页面可能启用了动态渲染或反爬策略，未能完整抓取正文。

原始链接：${url}

你仍可以继续让 AI 总结当前可得信息；如果结果不理想，建议手动复制正文后再粘贴。`,
    };
  }
}