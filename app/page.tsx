"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/app/providers/auth-provider";
import type { ProcessResult } from "@/types/bookmark";
import { createClient } from "@/utils/supabase/client";

import styles from "./page.module.css";

type ChatResponse = {
  answer?: string;
  error?: string;
};

export default function Home() {
  const router = useRouter();
  const { authReady, isAuthenticated, userEmail, signOut } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("正在抓取网页内容…");
  const [loadingStage, setLoadingStage] = useState(1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [savedId, setSavedId] = useState("");
  const [question, setQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleSignOut = async () => {
    const signOutError = await signOut();
    if (signOutError) {
      alert(`退出失败：${signOutError.message}`);
      return;
    }
    router.push("/");
  };

  const handleProcessAndSave = async () => {
    if (!url.trim()) {
      setError("请先输入链接");
      return;
    }

    setLoading(true);
    setLoadingMessage("正在抓取网页内容…");
    setLoadingStage(1);
    setError("");
    setSavedId("");
    setQuestion("");
    setChatAnswer("");
    setChatError("");

    try {
      const processResponse = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const processed = (await processResponse.json()) as ProcessResult & {
        error?: string;
      };

      if (!processResponse.ok) {
        throw new Error(processed.error || "处理失败");
      }

      setLoadingMessage("AI 正在阅读文章…");
      setLoadingStage(2);
      setResult(processed);

      setLoadingMessage("正在保存到知识库…");
      setLoadingStage(3);

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("请先登录");
        router.push("/auth");
        return;
      }

      const tags = Array.isArray(processed.tags) && processed.tags.length > 0 ? processed.tags : ["未分类"];

      const { data: inserted, error: insertError } = await supabase
        .from("bookmarks")
        .insert({
          user_id: user.id,
          title: processed.title,
          url: processed.url,
          content: processed.content,
          summary: processed.summary,
          outline: Array.isArray(processed.outline) ? processed.outline : [],
          tags,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error("保存失败:", insertError);
        alert(`保存失败：${insertError?.message || "未知错误"}`);
        return;
      }

      setSavedId(inserted.id);
      alert("已保存到知识库");
      setLoadingMessage("保存完成，可直接在当前页继续问 AI");
      setLoadingStage(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!savedId) {
      setChatError("请先完成一次解析并保存");
      return;
    }

    if (!question.trim()) {
      setChatError("请输入问题");
      return;
    }

    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarkId: savedId,
          question: question.trim(),
        }),
      });

      const data = (await response.json()) as ChatResponse;
      if (!response.ok) {
        throw new Error(data.error || "提问失败");
      }

      setChatAnswer(data.answer || "模型未返回内容");
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.topInner}>
          <div className={styles.brand}>LinkMind</div>
          <div className={styles.navLinks}>
            <span className={styles.active}>首页</span>
            <Link href="/history">知识库</Link>
            {!authReady ? (
              <span className={styles.authHint}>加载中...</span>
            ) : isAuthenticated ? (
              <div className={styles.authBox}>
                <span className={styles.authHint}>{userEmail || "已登录"}</span>
                <button type="button" onClick={handleSignOut}>
                  退出
                </button>
              </div>
            ) : (
              <Link href="/auth">登录 / 注册</Link>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.heroBlur} />
        <section className={styles.hero}>
          <h1>LinkMind</h1>
          <p>让碎片信息变结构化知识</p>
        </section>

        <section className={styles.inputArea}>
          <div className={styles.inputWrap}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="粘贴知乎 / B站 / 小红书 / 公众号链接…"
            />
            <button onClick={handleProcessAndSave} disabled={loading}>
              {loading ? "处理中..." : "智能解析并保存"}
            </button>
          </div>

          <div className={styles.quickLinks}>
            <Link href="/history">查看历史记录</Link>
            {savedId ? <span>已保存：{savedId.slice(0, 8)}...</span> : null}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        {result ? (
          <section className={styles.resultCard}>
            <h2>处理结果预览</h2>
            <p>
              <strong>标题：</strong>
              {result.title}
            </p>
            <p>
              <strong>摘要：</strong>
              {result.summary}
            </p>
            <div>
              <strong>大纲：</strong>
              <ul>
                {result.outline.map((item, idx) => (
                  <li key={`${idx}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.tags}>
              {result.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </section>
        ) : null}

        {savedId ? (
          <section className={styles.chatPanel}>
            <div className={styles.chatTitleRow}>
              <h3>继续提问 AI</h3>
              <span>基于当前文章</span>
            </div>
            <textarea
              className={styles.chatInput}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：请把这篇文章的结构图转成执行步骤"
              rows={3}
            />
            <div className={styles.chatActions}>
              <button onClick={handleAsk} disabled={chatLoading}>
                {chatLoading ? "思考中..." : "提问"}
              </button>
            </div>
            {chatError ? <p className={styles.error}>{chatError}</p> : null}
            {chatAnswer ? (
              <div className={styles.chatAnswer}>
                <h4>AI 回答</h4>
                <p>{chatAnswer}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={styles.bento}>
          <article className={styles.largeCard}>
            <h3>将长文浓缩为可执行洞察</h3>
            <p>自动提取正文、生成摘要与结构化大纲，减少信息噪音。</p>
          </article>
          <article className={styles.smallCard}>
            <h3>结构化存储</h3>
            <p>收藏不再是死链接，而是可检索、可追问的知识资产。</p>
          </article>
          <article className={styles.smallCard}>
            <h3>跨端同步</h3>
            <p>在不同设备上保持同一条知识链路与上下文。</p>
          </article>
          <article className={styles.ctaCard}>
            <h3>即刻开始构建你的第二大脑</h3>
            <p>输入任意链接，LinkMind 帮你完成知识化处理。</p>
          </article>
        </section>
      </main>

      {loading ? (
        <section className={styles.loadingOverlay}>
          <div className={styles.loadingGlowPrimary} />
          <div className={styles.loadingGlowSecondary} />
          <div className={styles.loadingCard}>
            <div className={styles.loadingIconWrap}>
              <div className={styles.loadingRing} />
              <div className={styles.loadingRingLarge} />
              <span className={styles.loadingIcon}>✦</span>
            </div>
            <p className={styles.loadingTitle}>{loadingMessage}</p>
            <p className={styles.loadingSubTitle}>智能引擎运行中</p>
            <div className={styles.loadingSteps}>
              <div className={loadingStage >= 1 ? styles.stepActive : styles.stepPending}>
                <strong>已连接至数据源</strong>
                <span>正在抓取并解析网页内容</span>
              </div>
              <div className={loadingStage >= 2 ? styles.stepActive : styles.stepPending}>
                <strong>AI 正在阅读文章</strong>
                <span>提取核心观点与上下文关联</span>
              </div>
              <div className={loadingStage >= 3 ? styles.stepActive : styles.stepPending}>
                <strong>生成摘要并保存中</strong>
                <span>准备当前页 AI 对话入口</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
