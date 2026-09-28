"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/icon";
import PhotoImage from "@/components/photo-image";
import type { Album, Photo } from "@/lib/gallery";

type Direction = 1 | -1;

export default function AlbumViewer({ album, isAdmin }: { album: Album; isAdmin: boolean }) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<{ photo: Photo; direction: Direction } | null>(null);
  const [direction, setDirection] = useState<Direction>(1);
  const [notice, setNotice] = useState("");
  const pointerStart = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photos = album.photos;
  const current = photos[index];

  const show = useCallback((nextIndex: number, nextDirection?: Direction) => {
    if (photos.length < 2 || nextIndex === index) return;
    const resolved = ((nextIndex % photos.length) + photos.length) % photos.length;
    const movement = nextDirection ?? (resolved > index ? 1 : -1);
    if (timer.current) clearTimeout(timer.current);
    setPrevious({ photo: photos[index], direction: movement });
    setDirection(movement);
    setIndex(resolved);
    timer.current = setTimeout(() => setPrevious(null), 650);
  }, [index, photos]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") show(index + 1, 1);
      if (event.key === "ArrowLeft") show(index - 1, -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, show]);

  useEffect(() => {
    if (photos.length < 2) return;
    const preload = new window.Image();
    preload.src = photos[(index + 1) % photos.length].src;
  }, [index, photos]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function shareAlbum() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("相册链接已复制");
    } catch {
      setNotice("请复制浏览器地址分享相册");
    }
  }

  if (!current) {
    return <main className="album-viewer album-viewer-empty"><Link href="/" className="album-back">← 返回相册集</Link><Icon name="camera" size={42}/><h1>{album.title}</h1><p>这本相册还没有照片。</p>{isAdmin && <Link className="album-admin-link" href="/admin">前往管理空间上传照片</Link>}</main>;
  }

  return <main className="album-viewer" onPointerDown={event => { pointerStart.current = event.clientX; }} onPointerUp={event => { if (pointerStart.current === null) return; const distance = event.clientX - pointerStart.current; pointerStart.current = null; if (Math.abs(distance) > 60) show(index + (distance < 0 ? 1 : -1), distance < 0 ? 1 : -1); }}>
    <header className="album-viewer-header"><Link href="/" className="album-viewer-brand">拾光</Link><nav><Link href="/">首页</Link>{isAdmin && <Link href="/admin">管理</Link>}<button type="button" onClick={shareAlbum}>分享相册</button></nav></header>

    <div className="album-stage" aria-live="polite">
      {previous && <PhotoImage key={`previous-${previous.photo.id}`} src={previous.photo.src} alt="" className={`album-frame album-frame-exit ${previous.direction === 1 ? "is-forward" : "is-backward"}`} priority />}
      <PhotoImage key={current.id} src={current.src} alt={current.title} className={`album-frame album-frame-enter ${direction === 1 ? "is-forward" : "is-backward"}`} priority />
      <div className="album-shade" />
    </div>

    <aside className="album-story">
      <Link href="/" className="album-back">← 返回相册集</Link>
      <div className="album-story-copy">
        <p className="album-chapter">相册 · {String(index + 1).padStart(2, "0")}</p>
        <h1>{album.title}</h1>
        <div className="album-accent" />
        <h2>{current.title}</h2>
        <p>{current.description || album.description || "把这一刻，留在光里。"}</p>
      </div>
      <div className="album-counter"><strong>{String(index + 1).padStart(2, "0")}</strong><span>/ {String(photos.length).padStart(2, "0")}</span></div>
    </aside>

    <div className="album-location"><Icon name="pin" size={17}/><span>{current.location || "地点未记录"}</span></div>
    <button className="album-arrow album-arrow-left" type="button" onClick={() => show(index - 1, -1)} disabled={photos.length < 2} aria-label="上一张照片"><Icon name="arrow" size={23}/></button>
    <button className="album-arrow album-arrow-right" type="button" onClick={() => show(index + 1, 1)} disabled={photos.length < 2} aria-label="下一张照片"><Icon name="arrow" size={23}/></button>

    <div className="album-progress" aria-label="选择照片">{photos.map((photo, photoIndex) => <button key={photo.id} className={photoIndex === index ? "is-active" : ""} type="button" onClick={() => show(photoIndex)} aria-label={`查看第 ${photoIndex + 1} 张：${photo.title}`}><span /><small>{String(photoIndex + 1).padStart(2, "0")}</small></button>)}</div>
    <p className="album-hint">使用方向键或滑动切换照片</p>
    {notice && <div className="album-toast" role="status">{notice}</div>}
  </main>;
}
