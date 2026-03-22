"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/utils/supabase/client";

import styles from "./page.module.css";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password.trim()) {
      setError("请输入邮箱和密码");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw new Error(signInError.message);
        }

        setSuccess("登录成功，正在进入系统...");
        router.push("/");
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      setSuccess("注册成功，请直接登录");
      setMode("signin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.topInner}>
          <div className={styles.brand}>LinkMind</div>
          <nav className={styles.nav}>
            <Link href="/">首页</Link>
            <Link href="/history">知识库</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h1>{mode === "signin" ? "欢迎回来" : "创建你的账号"}</h1>
          <p>{mode === "signin" ? "登录后可保存并管理你的知识库" : "注册后即可开始保存链接与 AI 洞察"}</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              邮箱
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}

            <button type="submit" disabled={loading}>
              {loading ? "处理中..." : mode === "signin" ? "登录" : "注册"}
            </button>
          </form>

          <div className={styles.switchRow}>
            {mode === "signin" ? "还没有账号？" : "已有账号？"}
            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === "signin" ? "signup" : "signin"));
                setError("");
                setSuccess("");
              }}
            >
              {mode === "signin" ? "去注册" : "去登录"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}