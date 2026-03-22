import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

import AIChatPanel from "./ai-chat-panel";
import styles from "./page.module.css";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

type BookmarkItem = {
  id: string;
  user_id: string | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  outline: string[];
  tags: string[] | null;
  created_at: string;
};

type WordCloudToken = {
  word: string;
  left: number;
  top: number;
  size: number;
  rotate: number;
  color: string;
  opacity: number;
  weight: 600 | 700 | 800;
};

const WORD_CLOUD_COLORS = ["#5b21b6", "#7c3aed", "#9333ea", "#4f46e5", "#6d28d9", "#a21caf"];

const WORD_STOP_WORDS = new Set([
  "我们",
  "你们",
  "他们",
  "这个",
  "那个",
  "一些",
  "一个",
  "以及",
  "可以",
  "如果",
  "然后",
  "就是",
  "因为",
  "所以",
  "进行",
  "通过",
  "对于",
  "关于",
  "内容",
  "文章",
  "链接",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "http",
  "https",
  "www",
  "com",
]);

function getDomainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "未知站点";
  }
}

function deriveDisplayTitle(item: Pick<BookmarkItem, "title" | "summary" | "url">) {
  const rawTitle = item.title?.trim() || "";
  const isExtractorFallback = /^未能提取网页标题/.test(rawTitle);
  const looksLikeUrl =
    /^https?:\/\//i.test(rawTitle) || /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(rawTitle);

  if (rawTitle && !isExtractorFallback && !looksLikeUrl) {
    return rawTitle;
  }

  const summaryHead = (item.summary || "")
    .replace(/\s+/g, " ")
    .split(/[。！？.!?]/)[0]
    ?.trim();

  if (summaryHead && summaryHead.length >= 8) {
    return summaryHead.slice(0, 42);
  }

  return `${getDomainLabel(item.url)} 的内容解读`;
}

function hashSeed(seed: string) {
  let hash = 0;
  for (const ch of seed) {
    hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tokenizeForCloud(raw: string) {
  return raw
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/[^a-zA-Z0-9\u4e00-\u9fa5#]+/g)
    .map((token) => token.replace(/^#+|#+$/g, "").trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 14 &&
        !WORD_STOP_WORDS.has(token) &&
        !WORD_STOP_WORDS.has(token.toLowerCase()),
    );
}

function buildWordCloudTokens(item: BookmarkItem, displayTitle: string): WordCloudToken[] {
  const sourceText = [
    displayTitle,
    getDomainLabel(item.url),
    item.summary || "",
    ...(item.outline || []),
    ...((item.tags || []).map((tag) => `#${tag}`) || []),
    (item.content || "").slice(0, 1200),
  ].join(" ");

  const frequency = new Map<string, number>();
  for (const token of tokenizeForCloud(sourceText)) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  if (frequency.size === 0) {
    for (const fallbackWord of ["知识", "洞察", "摘要", "要点", getDomainLabel(item.url)]) {
      frequency.set(fallbackWord, 1);
    }
  }

  const entries = Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 26);

  const maxCount = entries[0]?.[1] || 1;
  const seed = hashSeed(`${item.id}-${displayTitle}`);

  return entries.map(([word, count], index) => {
    const ring = Math.floor(index / 6) + 1;
    const angle = (seed + index * 47) % 360;
    const rad = (angle * Math.PI) / 180;
    const left = clamp(50 + Math.cos(rad) * (9 + ring * 10), 12, 88);
    const top = clamp(50 + Math.sin(rad) * (7 + ring * 8), 14, 86);
    const ratio = count / maxCount;
    const size = Math.round(14 + ratio * 16 + (index < 3 ? 4 : 0));
    const rotate = ((hashSeed(`${word}-${index}`) % 3) - 1) * 18;

    return {
      word,
      left,
      top,
      size,
      rotate,
      color: WORD_CLOUD_COLORS[(hashSeed(word) + index) % WORD_CLOUD_COLORS.length],
      opacity: 0.68 + Math.min(0.28, ratio * 0.24),
      weight: count === maxCount ? 800 : ratio >= 0.6 ? 700 : 600,
    };
  });
}

export default async function DetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    notFound();
  }

  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const item = data as BookmarkItem;
  const displayTitle = deriveDisplayTitle(item);
  const outlineItems = (item.outline || []).filter(Boolean);
  const tags = (item.tags || []).filter(Boolean);
  const wordCloudTokens = buildWordCloudTokens(item, displayTitle);
  const savedAt = item.created_at
    ? new Date(item.created_at).toLocaleString("zh-CN")
    : "未知时间";

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topInner}>
          <div className={styles.topLeft}>
            <span className={styles.brand}>LinkMind</span>
            <nav className={styles.nav}>
              <Link href="/">首页</Link>
              <Link href="/history" className={styles.active}>
                知识库
              </Link>
            </nav>
          </div>

          <div className={styles.topRight}>
            <div className={styles.searchBadge}>搜索洞察</div>
            <div className={styles.avatar} aria-hidden="true">
              我
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.leftPanel}>
          <nav className={styles.breadcrumb}>
            <Link href="/history">知识库</Link>
            <span>/</span>
            <span>链接详情</span>
          </nav>

          <div className={styles.resourceHeader}>
            <div className={styles.resourceRow}>
              <span className={styles.resourceTag}>资源</span>
            </div>
            <h1 title={displayTitle}>{displayTitle}</h1>
            <div className={styles.metaRow}>
              <a href={item.url} target="_blank" rel="noreferrer">
                {getDomainLabel(item.url)}
              </a>
              <span>•</span>
              <span>收藏于 {savedAt}</span>
            </div>
          </div>

          <div className={styles.coverPlaceholder}>
            <div className={styles.wordCloud} role="img" aria-label={`${displayTitle} 词云图`}>
              {wordCloudTokens.map((token) => (
                <span
                  key={`${token.word}-${token.left}-${token.top}`}
                  className={styles.wordCloudToken}
                  style={{
                    left: `${token.left}%`,
                    top: `${token.top}%`,
                    fontSize: `${token.size}px`,
                    transform: `translate(-50%, -50%) rotate(${token.rotate}deg)`,
                    color: token.color,
                    opacity: token.opacity,
                    fontWeight: token.weight,
                  }}
                >
                  {token.word}
                </span>
              ))}
            </div>
          </div>

          <section className={styles.originalCard}>
            <div className={styles.sectionTitleRow}>
              <span />
              <strong className={styles.sectionTitle}>原文片段</strong>
              <span />
            </div>
            <p className={styles.content}>{item.content || "暂无正文内容"}</p>
          </section>
        </section>

        <aside className={styles.rightPanel}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHead}>
              <div>
                <span>AI 摘要</span>
                <h3>核心观点</h3>
              </div>
            </div>
            <p>{item.summary || "暂无 AI 摘要，稍后可通过提问继续挖掘。"}</p>
          </section>

          <section className={styles.outlineCard}>
            <h4>
              <span>概念框架</span>
            </h4>
            <ol className={styles.graph}>
              {(outlineItems.length ? outlineItems : ["暂无结构化提纲，尝试继续提问 AI 深挖。"]).map(
                (line, index) => (
                  <li key={`${index}-${line}`} className={styles.graphNode}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{line}</strong>
                    </div>
                  </li>
                ),
              )}
            </ol>
          </section>

          <section className={styles.tagsCard}>
            <h4>语义标签</h4>
            <div className={styles.tags}>
              {(tags.length ? tags : ["未分类"]).map((tag, index) => (
                <span key={tag} className={index === 0 ? styles.tagActive : ""}>
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <AIChatPanel bookmarkId={item.id} />
        </aside>
      </main>
    </div>
  );
}