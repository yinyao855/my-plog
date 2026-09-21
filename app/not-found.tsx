import Link from "next/link";

export default function NotFound() {
  return <main className="empty-page"><span className="page-kicker">拾光 · 404</span><h1>这一页，还没有留下光。</h1><p>相册可能已设为私密，或这个地址已不存在。</p><Link href="/" className="button button-primary">回到影像集</Link></main>;
}
