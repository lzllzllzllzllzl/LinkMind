export interface ExtractedContent {
  title: string;
  content: string;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMainHtml(html: string) {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch?.[0]) return articleMatch[0];

  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch?.[0]) return mainMatch[0];

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  if (bodyMatch?.[0]) return bodyMatch[0];

  return html;
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
  const title = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  if (!title || looksLikeUrl(title)) {
    return getFallbackTitle(fallbackUrl);
  }
  return title;
}

function pickMetaTitle(html: string) {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+itemprop=["']headline["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ];

  for (const pattern of patterns) {
    const matched = html.match(pattern)?.[1];
    if (matched?.trim()) return matched;
  }

  return "";
}

function pickTitle(html: string, fallbackUrl: string) {
  const raw = pickMetaTitle(html);
  if (!raw) return getFallbackTitle(fallbackUrl);
  return normalizeTitle(raw, fallbackUrl);
}

async function extractViaDirectFetch(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`抓取失败，状态码: ${response.status}`);
  }

  const html = await response.text();
  const title = pickTitle(html, url);
  const content = stripHtml(pickMainHtml(html)).slice(0, 12000);

  if (!content) {
    throw new Error("未提取到正文内容");
  }

  return { title, content };
}

async function extractViaJinaReader(url: string): Promise<ExtractedContent> {
  const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const response = await fetch(readerUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Jina Reader 抓取失败，状态码: ${response.status}`);
  }

  const text = (await response.text()).trim();
  if (!text) {
    throw new Error("Jina Reader 未返回内容");
  }

  const lines = text.split("\n").filter((line) => line.trim());
  const title = lines[0]?.trim() || url;
  const content = text.slice(0, 12000);

  return { title, content };
}

export async function extractMainContent(url: string): Promise<ExtractedContent> {
  try {
    return await extractViaDirectFetch(url);
  } catch {
    try {
      return await extractViaJinaReader(url);
    } catch {
      return {
        title: `未能提取网页标题（${url}）`,
        content:
          "内容提取失败，已使用MVP回退文本。你可以稍后重试，或接入更稳定的网页解析服务。",
      };
    }
  }
}