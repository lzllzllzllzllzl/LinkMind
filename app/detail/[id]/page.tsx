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

const DEFAULT_COVER_IMAGES = [
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&q=80",
];

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

function pickFallbackCover(seed: string) {
  const hash = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return DEFAULT_COVER_IMAGES[hash % DEFAULT_COVER_IMAGES.length];
}

function normalizeImageUrl(raw: string, pageUrl: string) {
  const clean = raw.trim().replace(/&amp;/gi, "&");
  if (!clean || clean.startsWith("data:")) return "";
  try {
    return new URL(clean, pageUrl).toString();
  } catch {
    return "";
  }
}

async function resolveCoverImage(pageUrl: string, seed: string) {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return pickFallbackCover(seed);
    }

    const html = await response.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/i,
      /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      if (!match) continue;
      const normalized = normalizeImageUrl(match, pageUrl);
      if (normalized) return normalized;
    }

    return pickFallbackCover(seed);
  } catch {
    return pickFallbackCover(seed);
  }
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
  const coverImage = await resolveCoverImage(item.url, item.id);
  const fallbackCover = pickFallbackCover(`${item.id}-backup`);
  const savedAt = item.created_at
    ? new Date(item.created_at).toLocaleString("zh-CN")
    : "未知时间";
  const outlineItems = (item.outline || []).filter(Boolean);
  const tags = (item.tags || []).filter(Boolean);

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
            <label className={styles.searchWrap}>
              <span className="material-symbols-outlined">search</span>
              <input placeholder="搜索洞察..." />
            </label>
            <button className={styles.iconBtn} aria-label="通知">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className={styles.iconBtn} aria-label="设置">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className={styles.avatar} aria-hidden="true">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.leftPanel}>
          <nav className={styles.breadcrumb}>
            <Link href="/history">知识库</Link>
            <span className="material-symbols-outlined">chevron_right</span>
            <span>链接详情</span>
          </nav>

          <div className={styles.resourceHeader}>
            <div className={styles.resourceRow}>
              <span className={`material-symbols-outlined ${styles.resourceIcon}`}>article</span>
              <span className={styles.resourceTag}>资源</span>
            </div>
            <h1 title={displayTitle}>{displayTitle}</h1>
            <div className={styles.metaRow}>
              <a href={item.url} target="_blank" rel="noreferrer">
                <span className="material-symbols-outlined">link</span>
                <span>{getDomainLabel(item.url)}</span>
              </a>
              <span>•</span>
              <span>收藏于 {savedAt}</span>
            </div>
          </div>

          <div className={styles.coverPlaceholder}>
            <div
              className={styles.coverImage}
              role="img"
              aria-label={displayTitle}
              style={{ backgroundImage: `url("${coverImage}"), url("${fallbackCover}")` }}
            />
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
              <div className={styles.summaryIconWrap}>
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <div>
                <span>AI 摘要</span>
                <h3>核心观点</h3>
              </div>
            </div>
            <p>{item.summary || "暂无 AI 摘要，稍后可通过提问继续挖掘。"}</p>
          </section>

          <section className={styles.outlineCard}>
            <h4>
              <span className="material-symbols-outlined">format_list_bulleted</span>
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