"use client";

import { useState } from "react";

import styles from "./ai-chat-panel.module.css";

type AIChatPanelProps = {
  bookmarkId: string;
};

type ChatResponse = {
  answer?: string;
  error?: string;
};

export default function AIChatPanel({ bookmarkId }: AIChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = async () => {
    if (!question.trim()) {
      setError("请输入问题");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookmarkId,
          question: question.trim(),
        }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(data.error || "提问失败");
      }

      setAnswer(data.answer || "模型未返回内容");
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="ai-chat" className={styles.panel}>
      <div className={styles.titleRow}>
        <h3>继续提问 AI</h3>
        <span>服务端调用</span>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="例如：这篇文章的核心创新点是什么？"
        rows={3}
      />

      <div className={styles.actions}>
        <button onClick={handleAsk} disabled={loading}>
          {loading ? "思考中..." : "提问"}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {answer ? (
        <div className={styles.answer}>
          <h4>AI 回答</h4>
          <p>{answer}</p>
        </div>
      ) : null}
    </section>
  );
}