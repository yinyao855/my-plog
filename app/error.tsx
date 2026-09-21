"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="empty-page"><span className="page-kicker">暂时无法加载</span><h1>稍等，让光再来一次。</h1><p>服务暂时不可用，请稍后重试。站点管理员可检查数据库连接及服务日志。</p><button className="button button-primary" onClick={reset}>重新加载</button></main>;
}
