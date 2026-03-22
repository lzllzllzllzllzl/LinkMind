import Link from "next/link";

import { createClient } from "@/utils/supabase/server";

import styles from "./page.module.css";

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

const ACCENT_CLASSES = [styles.accentPrimary, styles.accentSecondary, styles.accentTertiary];
const LABEL_CLASSES = [styles.labelPrimary, styles.labelSecondary, styles.labelTertiary];
const SUMMARY_CLASSES = [styles.summaryPrimary, styles.summarySecondary, styles.summaryTertiary];
const ICON_CLASSES = [styles.iconPrimary, styles.iconSecondary, styles.iconTertiary];

function formatRelativeTime(dateString: string, index: number) {
  if (index === 0) return "刚刚";
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "未知时间";

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }

  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }

  if (diff < day * 2) {
    return "昨天";
  }

  return new Date(dateString).toLocaleDateString("zh-CN");
}

function getDomainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "来源链接";
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
    return summaryHead.slice(0, 36);
  }

  return `${getDomainLabel(item.url)} 的内容解读`;
}

function TopBar({
  userEmail,
  showAuthLink,
}: {
  userEmail?: string | null;
  showAuthLink?: boolean;
}) {
  return (
    <header className={styles.topNav}>
      <div className={styles.topInner}>
        <div className={styles.topLeft}>
          <span className={styles.brand}>LinkMind</span>
          <nav className={styles.nav}>
            <Link href="/">首页</Link>
            <span className={styles.active}>知识库</span>
          </nav>
        </div>

        <div className={styles.topRight}>
          <div className={styles.searchBadge}>
            <span className="material-symbols-outlined">search</span>
            <span>搜索知识库</span>
          </div>

          <Link href="/" className={styles.newLinkBtn}>
            <span className="material-symbols-outlined">add</span>
            <span>新建链接</span>
          </Link>

          <div className={styles.toolGroup}>
            <button className={styles.iconBtn} aria-label="通知">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className={styles.iconBtn} aria-label="设置">
              <span className="material-symbols-outlined">settings</span>
            </button>
            {showAuthLink ? (
              <Link href="/auth" className={styles.authLink}>
                登录
              </Link>
            ) : (
              <div className={styles.avatar} aria-hidden="true">
                {userEmail?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div className={styles.page}>
        <TopBar showAuthLink />
        <main className={styles.main}>
          <section className={styles.header}>
            <div>
              <h1>知识库</h1>
              <p>探索您收藏的智慧结晶与 AI 深度洞察</p>
            </div>
          </section>

          <section className={styles.emptyStateCard}>
            <div className={styles.emptyIcon}>
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <h3>请先登录查看</h3>
            <p>登录后即可查看你保存的链接、摘要与结构化洞察。</p>
            <Link href="/auth">去登录</Link>
          </section>
        </main>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className={styles.page}>
        <TopBar userEmail={user.email} />
        <main className={styles.main}>
          <section className={styles.emptyStateCard}>
            <div className={styles.emptyIcon}>
              <span className="material-symbols-outlined">error</span>
            </div>
            <h3>加载失败</h3>
            <p>{error.message}</p>
            <Link href="/">返回首页</Link>
          </section>
        </main>
      </div>
    );
  }

  const list = (data ?? []) as BookmarkItem[];

  return (
    <div className={styles.page}>
      <TopBar userEmail={user.email} />

      <main className={styles.main}>
        <section className={styles.header}>
          <div>
            <h1>知识库</h1>
            <p>探索您收藏的智慧结晶与 AI 深度洞察</p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.actionBtn}>
              <span className="material-symbols-outlined">filter_list</span>
              <span>筛选</span>
            </button>
            <button className={styles.actionBtn}>
              <span className="material-symbols-outlined">sort</span>
              <span>最近使用</span>
            </button>
          </div>
        </section>

        <ul className={styles.grid}>
          {list.map((item, index) => {
            const displayTitle = deriveDisplayTitle(item);
            return (
              <li
                key={item.id}
                className={`${styles.card} ${ACCENT_CLASSES[index % ACCENT_CLASSES.length]}`}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardHead}>
                    <span
                      className={`${styles.label} ${LABEL_CLASSES[index % LABEL_CLASSES.length]}`}
                    >
                      #{(item.tags?.[0] || "知识").slice(0, 8)}
                    </span>
                    <span className={styles.time}>{formatRelativeTime(item.created_at, index)}</span>
                  </div>

                  <Link href={`/detail/${item.id}`} className={styles.title} title={displayTitle}>
                    {displayTitle}
                  </Link>

                  <div
                    className={`${styles.summaryBox} ${
                      SUMMARY_CLASSES[index % SUMMARY_CLASSES.length]
                    }`}
                  >
                    <p className={styles.summary}>{item.summary || "暂无摘要内容"}</p>
                  </div>

                  <div className={styles.tags}>
                    {(item.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </div>

                <div className={styles.cardFoot}>
                  <div className={styles.footUrl}>
                    <span
                      className={`material-symbols-outlined ${
                        ICON_CLASSES[index % ICON_CLASSES.length]
                      }`}
                    >
                      link
                    </span>
                    <span title={item.url}>{getDomainLabel(item.url)}</span>
                  </div>
                  <Link href={`/detail/${item.id}`} className={styles.moreBtn} aria-label="查看详情">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </Link>
                </div>
              </li>
            );
          })}

          <li className={styles.emptyCardTile}>
            <div className={styles.emptyIcon}>
              <span className="material-symbols-outlined">add_circle</span>
            </div>
            <h3>开始新的探索</h3>
            <p>粘贴任何链接，让 AI 为您提取深度洞察</p>
            <Link href="/">立即添加</Link>
          </li>
        </ul>

        {list.length > 0 ? (
          <div className={styles.loadMoreWrap}>
            <button className={styles.loadMoreBtn}>
              <span>加载更多记录</span>
              <span className="material-symbols-outlined">keyboard_arrow_down</span>
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}