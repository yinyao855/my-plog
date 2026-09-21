import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { getAdminSession, isAdminConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "管理员登录",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <main className="auth-page">
      <Link href="/" className="auth-back">← 返回影像首页</Link>
      <section className="auth-card">
        <div className="auth-brand">拾光<span>影像管理</span></div>
        <p className="eyebrow">摄影师的工作台</p>
        <h1>欢迎回到<br /><em>你的光影世界。</em></h1>
        <p className="auth-description">整理那些值得珍藏的瞬间，<br />让每一本相册，都有自己的故事。</p>
        <LoginForm configured={isAdminConfigured()} />
      </section>
      <div className="auth-photo" aria-hidden="true"><p>让时光停留，让故事发生。<span>光影之间，皆是生活。</span></p></div>
    </main>
  );
}
