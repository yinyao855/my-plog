"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !configured) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登录失败，请稍后重试。");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "网络连接失败，请稍后重试。");
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={login}>
      {!configured && <p className="notice" role="status">管理员账号尚未配置。请站点所有者按项目 README 完成账号配置后再登录。</p>}
      <label className="field">
        <span>管理员账号</span>
        <input name="username" type="text" autoComplete="username" placeholder="输入你的账号" maxLength={80} required disabled={!configured || pending} autoCapitalize="none" spellCheck={false} />
      </label>
      <label className="field">
        <span>登录密码</span>
        <span className="password-field">
          <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="输入你的密码" required disabled={!configured || pending} />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "隐藏密码" : "显示密码"} aria-pressed={showPassword}>{showPassword ? "隐藏" : "显示"}</button>
        </span>
      </label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button primary auth-submit" type="submit" disabled={!configured || pending}>{pending ? "正在登录…" : "登录管理空间"}<span aria-hidden="true">↗</span></button>
      <p className="auth-help">这里是摄影师的管理空间。欣赏照片无需登录。</p>
    </form>
  );
}
