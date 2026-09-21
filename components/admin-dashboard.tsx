"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import Icon from "@/components/icon";
import Modal from "@/components/modal";
import PhotoImage from "@/components/photo-image";
import type { Album, Photo } from "@/lib/gallery";

type AdminDashboardProps = {
  albums: Album[];
  demo: boolean;
  username: string;
};

type DeleteTarget =
  | { kind: "album"; album: Album }
  | { kind: "photo"; photo: Photo };

async function request<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("无法连接服务器，请检查网络后重试。");
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error ?? "操作未完成，请稍后重试。");
  }

  return result as T;
}

function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="notice notice-error" role="alert">
      {message}
    </p>
  ) : null;
}

function AlbumFields({ album }: { album?: Album }) {
  return (
    <>
      <label className="field">
        <span>相册名称</span>
        <input
          name="title"
          defaultValue={album?.title ?? ""}
          placeholder="比如：在山野之间"
          maxLength={120}
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>写在相册前面</span>
        <textarea
          name="description"
          defaultValue={album?.description ?? ""}
          placeholder="为这些照片，留下一段故事。"
          maxLength={2000}
          rows={4}
        />
      </label>
      <label className="field">
        <span>谁可以看到</span>
        <select name="visibility" defaultValue={album?.visibility ?? "PRIVATE"}>
          <option value="PRIVATE">仅自己可见</option>
          <option value="PUBLIC">公开展示</option>
        </select>
        <small className="field-help">
          公开相册会出现在主页；私密相册仅登录后可见。
        </small>
      </label>
    </>
  );
}

export default function AdminDashboard({
  albums,
  demo,
  username,
}: AdminDashboardProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(albums[0]?.id ?? "");
  const [editor, setEditor] = useState<{ album?: Album } | null>(null);
  const [uploadAlbum, setUploadAlbum] = useState<Album | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedAlbum = albums.find((album) => album.id === selectedId) ?? albums[0];
  const photoCount = albums.reduce((total, album) => total + album.photos.length, 0);
  const publicCount = albums.filter((album) => album.visibility === "PUBLIC").length;
  const pending = busy || refreshing;
  const disabled = pending || demo;
  const modalOpen = editor !== null || uploadAlbum !== null || deleteTarget !== null;

  function refresh(message: string) {
    setMessage(message);
    startTransition(() => router.refresh());
  }

  async function mutate(action: () => Promise<void>) {
    if (pending) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }

  function openEditor(album?: Album) {
    setError("");
    setEditor({ album });
  }

  function closeModal() {
    if (pending) return;
    setEditor(null);
    setUploadAlbum(null);
    setDeleteTarget(null);
    setError("");
  }

  function saveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || demo) return;

    const form = new FormData(event.currentTarget);
    const existing = editor.album;

    void mutate(async () => {
      const result = await request<{ album: Album }>(
        existing ? `/api/albums/${encodeURIComponent(existing.id)}` : "/api/albums",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: String(form.get("title") ?? "").trim(),
            description: String(form.get("description") ?? "").trim(),
            visibility: form.get("visibility"),
          }),
        },
      );

      setSelectedId(result.album.id);
      setEditor(null);
      refresh(existing ? "相册信息已保存。" : "相册已创建，可以开始放入照片了。");
    });
  }

  function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadAlbum || demo) return;

    const form = new FormData(event.currentTarget);
    const file = form.get("file");

    if (!(file instanceof File) || !file.size) {
      setError("请先选择一张照片。");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("照片大小不能超过 10 MB，请选择较小的照片。");
      return;
    }

    const albumId = uploadAlbum.id;

    void mutate(async () => {
      await request<{ photo: Photo }>(
        `/api/albums/${encodeURIComponent(albumId)}/photos`,
        { method: "POST", body: form },
      );

      setSelectedId(albumId);
      setUploadAlbum(null);
      refresh("照片已上传，新的瞬间已经收好。");
    });
  }

  function deleteItem() {
    if (!deleteTarget || demo) return;

    const target = deleteTarget;

    void mutate(async () => {
      const url = target.kind === "album"
        ? `/api/albums/${encodeURIComponent(target.album.id)}`
        : `/api/photos/${encodeURIComponent(target.photo.id)}`;

      await request<{ ok: boolean }>(url, { method: "DELETE" });
      setDeleteTarget(null);
      refresh(target.kind === "album" ? "相册已删除。" : "照片已删除。");
    });
  }

  function logout() {
    void mutate(async () => {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/" className="admin-brand" aria-label="回到拾光相册首页">
          <span>拾光</span>
          <small>影像管理</small>
        </Link>
        <div className="admin-user">
          <span>{username}</span>
          <Link className="button button-ghost" href="/">
            查看主页 <Icon name="arrow" />
          </Link>
          <button
            className="icon-button"
            type="button"
            aria-label="退出登录"
            title="退出登录"
            disabled={pending}
            onClick={logout}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <section className="admin-intro">
        <div>
          <p className="page-kicker">记录生活，自有章法</p>
          <h1>我的影像室</h1>
          <p>把喜欢的瞬间整理成册，让每一段记忆都有归处。</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => openEditor()}
          disabled={disabled}
        >
          <Icon name="plus" /> 新建相册
        </button>
      </section>

      {demo && (
        <p className="notice">
          当前显示示例相册。请先按照 README 配置 MySQL 并初始化数据表，之后即可创建相册和上传照片。
        </p>
      )}
      {!modalOpen && <ErrorNotice message={error} />}
      {message && (
        <p className="notice notice-success" role="status">{message}</p>
      )}

      <section className="admin-stats" aria-label="相册概览">
        <div className="admin-stat">
          <Icon name="grid" />
          <span>全部相册</span>
          <strong>{albums.length}</strong>
        </div>
        <div className="admin-stat">
          <Icon name="camera" />
          <span>珍藏照片</span>
          <strong>{photoCount}</strong>
        </div>
        <div className="admin-stat">
          <Icon name="share" />
          <span>公开相册</span>
          <strong>{publicCount}</strong>
        </div>
      </section>

      <div className="admin-grid" aria-busy={pending}>
        <aside className="admin-sidebar">
          <div className="admin-section-heading">
            <h2>相册目录</h2>
            <span>{albums.length} 本</span>
          </div>
          <nav className="admin-album-list" aria-label="选择管理的相册">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                className={`admin-album-select${selectedAlbum?.id === album.id ? " is-active" : ""}`}
                aria-pressed={selectedAlbum?.id === album.id}
                onClick={() => setSelectedId(album.id)}
              >
                <span className="album-thumbnail">
                  {album.photos[0] ? (
                    <PhotoImage src={album.photos[0].src} alt="" sizes="64px" />
                  ) : <Icon name="camera" />}
                </span>
                <span className="album-row-body">
                  <strong>{album.title}</strong>
                  <small>{album.photos.length} 张照片 · {album.visibility === "PUBLIC" ? "公开" : "私密"}</small>
                </span>
              </button>
            ))}
          </nav>
          {albums.length === 0 && <p className="field-help">还没有相册，创建第一本吧。</p>}
        </aside>

        <section className="admin-content" aria-label="相册内容">
          {selectedAlbum ? (
            <>
              <div className="admin-toolbar">
                <div>
                  <span className={`status-badge${selectedAlbum.visibility === "PRIVATE" ? " is-private" : ""}`}>
                    <Icon name={selectedAlbum.visibility === "PRIVATE" ? "lock" : "check"} />
                    {selectedAlbum.visibility === "PRIVATE" ? "仅自己可见" : "公开展示"}
                  </span>
                  <h2>{selectedAlbum.title}</h2>
                  <p>{selectedAlbum.description || "还没有写下故事，但照片会记得。"}</p>
                </div>
                <div className="album-row-actions">
                  <button
                    className="icon-button"
                    type="button"
                    title="编辑相册"
                    aria-label={`编辑相册：${selectedAlbum.title}`}
                    disabled={disabled}
                    onClick={() => openEditor(selectedAlbum)}
                  ><Icon name="edit" /></button>
                  <button
                    className="icon-button"
                    type="button"
                    title="删除相册"
                    aria-label={`删除相册：${selectedAlbum.title}`}
                    disabled={disabled}
                    onClick={() => {
                      setError("");
                      setDeleteTarget({ kind: "album", album: selectedAlbum });
                    }}
                  ><Icon name="trash" /></button>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setError("");
                      setUploadAlbum(selectedAlbum);
                    }}
                  ><Icon name="upload" /> 上传照片</button>
                </div>
              </div>

              {selectedAlbum.photos.length ? (
                <div className="photo-manager-grid">
                  {selectedAlbum.photos.map((photo) => (
                    <article className="photo-manager-card" key={photo.id}>
                      <div className="photo-manager-image">
                        <PhotoImage
                          src={photo.src}
                          alt={photo.title}
                          sizes="(max-width: 600px) 85vw, (max-width: 1000px) 40vw, 25vw"
                        />
                      </div>
                      <div className="photo-manager-info">
                        <div>
                          <h3>{photo.title}</h3>
                          <p>{photo.location || "未记录地点"}</p>
                        </div>
                        <button
                          className="icon-button"
                          type="button"
                          title="删除照片"
                          aria-label={`删除照片：${photo.title}`}
                          disabled={disabled}
                          onClick={() => {
                            setError("");
                            setDeleteTarget({ kind: "photo", photo });
                          }}
                        ><Icon name="trash" /></button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="camera" />
                  <h3>等待第一张照片</h3>
                  <p>从一个喜欢的瞬间，开启这本相册。</p>
                  <button
                    className="button button-ghost"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setError("");
                      setUploadAlbum(selectedAlbum);
                    }}
                  >选择照片 <Icon name="arrow" /></button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Icon name="grid" />
              <h2>为回忆，留一个位置</h2>
              <p>创建一本相册，记录一次旅行、一段日常，或一种心情。</p>
              <button
                className="button button-primary"
                type="button"
                disabled={disabled}
                onClick={() => openEditor()}
              ><Icon name="plus" /> 创建第一本相册</button>
            </div>
          )}
        </section>
      </div>

      {editor && (
        <Modal title={editor.album ? "编辑这本相册" : "开启一本新相册"} onClose={closeModal}>
          <form className="admin-form" onSubmit={saveAlbum}>
            <AlbumFields album={editor.album} />
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button className="button button-ghost" type="button" onClick={closeModal} disabled={pending}>取消</button>
              <button className="button button-primary" type="submit" disabled={disabled}>
                {busy ? "正在保存…" : editor.album ? "保存更改" : "创建相册"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {uploadAlbum && (
        <Modal title="收藏一个新瞬间" onClose={closeModal}>
          <form className="admin-form" onSubmit={uploadPhoto}>
            <p className="field-help">上传至「{uploadAlbum.title}」</p>
            <label className="field">
              <span>选择照片</span>
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
              <small className="field-help">支持 JPG、PNG、WebP，单张不超过 10 MB。</small>
            </label>
            <label className="field">
              <span>照片名称</span>
              <input name="title" maxLength={160} placeholder="留空则使用文件名" />
            </label>
            <label className="field">
              <span>拍摄地点</span>
              <input name="location" maxLength={120} placeholder="比如：云南 · 大理" />
            </label>
            <label className="field">
              <span>这一刻的故事</span>
              <textarea name="description" maxLength={2000} rows={3} placeholder="当时的风、光线，和心情。" />
            </label>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button className="button button-ghost" type="button" onClick={closeModal} disabled={pending}>取消</button>
              <button className="button button-primary" type="submit" disabled={disabled}>
                <Icon name="upload" /> {busy ? "正在上传…" : "上传照片"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={deleteTarget.kind === "album" ? "确认删除相册？" : "确认删除照片？"} onClose={closeModal}>
          <div className="admin-form">
            <p>
              {deleteTarget.kind === "album"
                ? `「${deleteTarget.album.title}」及其中的 ${deleteTarget.album.photos.length} 张照片、评论和点赞将被删除。`
                : `「${deleteTarget.photo.title}」及相关评论和点赞将被删除。`}
              此操作无法撤销。
            </p>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button className="button button-ghost" type="button" onClick={closeModal} disabled={pending}>保留</button>
              <button className="button button-danger" type="button" onClick={deleteItem} disabled={disabled}>
                <Icon name="trash" /> {busy ? "正在删除…" : "确认删除"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
