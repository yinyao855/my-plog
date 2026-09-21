import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getDatabase, isDatabaseConfigured } from "@/lib/db";
import { demoAlbums } from "@/lib/demo-data";
import type { Album, Comment, GalleryData, Photo } from "@/lib/gallery";
import { HttpError } from "@/lib/http";

type AlbumRow = RowDataPacket & { id: string; title: string; description: string; visibility: "PUBLIC" | "PRIVATE"; created_at: Date };
type PhotoRow = RowDataPacket & { id: string; album_id: string; storage_key: string; title: string; description: string; location: string; width: number; height: number; created_at: Date; likes: number };
type CommentRow = RowDataPacket & { id: string; author_name: string; body: string; created_at: Date };

const date = (value: Date | string) => new Date(value).toISOString();
const photoFrom = (row: PhotoRow): Photo => ({ id: row.id, albumId: row.album_id, title: row.title, description: row.description, location: row.location, src: `/media/${row.storage_key}`, width: row.width, height: row.height, createdAt: date(row.created_at), likes: Number(row.likes || 0) });

async function albumsFromRows(rows: AlbumRow[]): Promise<Album[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(row => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const [photos] = await getDatabase().query<PhotoRow[]>(`
    SELECT p.*, COUNT(l.photo_id) AS likes
    FROM photos p LEFT JOIN photo_likes l ON l.photo_id = p.id
    WHERE p.album_id IN (${placeholders})
    GROUP BY p.id
    ORDER BY p.created_at DESC`, ids);
  return rows.map(row => ({
    id: row.id, title: row.title, description: row.description, visibility: row.visibility,
    createdAt: date(row.created_at), photos: photos.filter(photo => photo.album_id === row.id).map(photoFrom),
  }));
}

export async function getGallery(includePrivate = false): Promise<GalleryData> {
  if (!isDatabaseConfigured()) return { albums: demoAlbums, demo: true };
  const [rows] = await getDatabase().query<AlbumRow[]>(`SELECT * FROM albums ${includePrivate ? "" : "WHERE visibility = 'PUBLIC'"} ORDER BY created_at DESC`);
  return { albums: await albumsFromRows(rows), demo: false };
}

export async function getAlbum(id: string, includePrivate = false): Promise<Album | null> {
  if (!isDatabaseConfigured()) return demoAlbums.find(album => album.id === id) ?? null;
  const [rows] = await getDatabase().query<AlbumRow[]>(`SELECT * FROM albums WHERE id = ? ${includePrivate ? "" : "AND visibility = 'PUBLIC'"} LIMIT 1`, [id]);
  return (await albumsFromRows(rows))[0] ?? null;
}

export async function createAlbum(input: { title: string; description: string; visibility: unknown }): Promise<Album> {
  const title = input.title.trim(); const description = input.description.trim();
  if (!title || title.length > 120 || description.length > 2000) throw new HttpError(400, "请填写 1–120 字的相册名称和不超过 2000 字的介绍。");
  const visibility = input.visibility === "PRIVATE" ? "PRIVATE" : input.visibility === "PUBLIC" ? "PUBLIC" : null;
  if (!visibility) throw new HttpError(400, "相册可见范围无效。");
  const id = randomUUID();
  await getDatabase().execute("INSERT INTO albums (id, title, description, visibility) VALUES (?, ?, ?, ?)", [id, title, description, visibility]);
  return (await getAlbum(id, true))!;
}

export async function updateAlbum(id: string, input: { title: string; description: string; visibility: unknown }): Promise<Album> {
  const title = input.title.trim(); const description = input.description.trim();
  if (!title || title.length > 120 || description.length > 2000) throw new HttpError(400, "请填写 1–120 字的相册名称和不超过 2000 字的介绍。");
  const visibility = input.visibility === "PRIVATE" ? "PRIVATE" : input.visibility === "PUBLIC" ? "PUBLIC" : null;
  if (!visibility) throw new HttpError(400, "相册可见范围无效。");
  const [result] = await getDatabase().execute("UPDATE albums SET title = ?, description = ?, visibility = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [title, description, visibility, id]);
  if ((result as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, "相册不存在。");
  return (await getAlbum(id, true))!;
}

export async function deleteAlbum(id: string): Promise<void> {
  const [result] = await getDatabase().execute("DELETE FROM albums WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) throw new HttpError(404, "相册不存在。");
}

export async function createPhoto(input: { albumId: string; storageKey: string; title: string; description: string; location: string; width: number; height: number }): Promise<Photo> {
  if (!(await getAlbum(input.albumId, true))) throw new HttpError(404, "相册不存在。");
  const title = input.title.trim() || "未命名照片";
  if (title.length > 160 || input.description.trim().length > 2000 || input.location.trim().length > 120) throw new HttpError(400, "照片信息过长，请精简后再试。");
  const id = randomUUID();
  await getDatabase().execute("INSERT INTO photos (id, album_id, storage_key, title, description, location, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, input.albumId, input.storageKey, title, input.description.trim(), input.location.trim(), input.width, input.height]);
  const album = await getAlbum(input.albumId, true);
  const photo = album?.photos.find(item => item.id === id);
  if (!photo) throw new HttpError(500, "照片保存后无法读取。");
  return photo;
}

export async function deletePhoto(id: string): Promise<{ storageKey: string }> {
  const [rows] = await getDatabase().query<(RowDataPacket & { storage_key: string })[]>("SELECT storage_key FROM photos WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new HttpError(404, "照片不存在。");
  await getDatabase().execute("DELETE FROM photos WHERE id = ?", [id]);
  return { storageKey: rows[0].storage_key };
}

export async function getPhotoVisibilityByStorageKey(key: string): Promise<"PUBLIC" | "PRIVATE" | null> {
  if (!isDatabaseConfigured()) return null;
  const [rows] = await getDatabase().query<(RowDataPacket & { visibility: "PUBLIC" | "PRIVATE" })[]>("SELECT a.visibility FROM photos p JOIN albums a ON a.id = p.album_id WHERE p.storage_key = ? LIMIT 1", [key]);
  return rows[0]?.visibility ?? null;
}

export async function getPhotoVisibility(id: string): Promise<"PUBLIC" | "PRIVATE" | null> {
  if (!isDatabaseConfigured()) return null;
  const [rows] = await getDatabase().query<(RowDataPacket & { visibility: "PUBLIC" | "PRIVATE" })[]>("SELECT a.visibility FROM photos p JOIN albums a ON a.id = p.album_id WHERE p.id = ? LIMIT 1", [id]);
  return rows[0]?.visibility ?? null;
}

export async function requirePublicPhoto(id: string): Promise<void> {
  if (await getPhotoVisibility(id) !== "PUBLIC") throw new HttpError(404, "照片不存在。");
}

export async function getComments(photoId: string): Promise<Comment[]> {
  if (!isDatabaseConfigured()) return [];
  const [rows] = await getDatabase().query<CommentRow[]>("SELECT id, author_name, body, created_at FROM comments WHERE photo_id = ? ORDER BY created_at DESC LIMIT 100", [photoId]);
  return rows.map(row => ({ id: row.id, author: row.author_name, body: row.body, createdAt: date(row.created_at) }));
}

export async function addComment(photoId: string, author: string, body: string): Promise<Comment> {
  author = author.trim(); body = body.trim();
  if (!author || author.length > 40 || !body || body.length > 1000) throw new HttpError(400, "请填写昵称和不超过 1000 字的评论。");
  const id = randomUUID();
  try { await getDatabase().execute("INSERT INTO comments (id, photo_id, author_name, body) VALUES (?, ?, ?, ?)", [id, photoId, author, body]); }
  catch { throw new HttpError(404, "照片不存在或暂时无法评论。"); }
  return { id, author, body, createdAt: new Date().toISOString() };
}

const visitorCookie = "lumen_visitor";
async function visitorHash(): Promise<Buffer> {
  const store = await cookies(); let value = store.get(visitorCookie)?.value;
  if (!value || !/^[A-Za-z0-9_-]{22}$/.test(value)) {
    value = randomUUID().replaceAll("-", "").slice(0, 22);
    store.set(visitorCookie, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 24 * 60 * 60 });
  }
  return createHash("sha256").update(`${process.env.SESSION_SECRET || "development-visitor-secret"}:${value}`).digest();
}

export async function getLike(photoId: string): Promise<{ likes: number; liked: boolean }> {
  if (!isDatabaseConfigured()) return { likes: 0, liked: false };
  const visitor = await visitorHash();
  const [[count], [mine]] = await Promise.all([
    getDatabase().query<(RowDataPacket & { likes: number })[]>("SELECT COUNT(*) AS likes FROM photo_likes WHERE photo_id = ?", [photoId]),
    getDatabase().query<RowDataPacket[]>("SELECT 1 FROM photo_likes WHERE photo_id = ? AND visitor_hash = ? LIMIT 1", [photoId, visitor]),
  ]);
  return { likes: Number(count[0]?.likes || 0), liked: Boolean(mine[0]) };
}

export async function setLike(photoId: string, liked: boolean): Promise<{ likes: number; liked: boolean }> {
  const visitor = await visitorHash();
  if (liked) {
    try { await getDatabase().execute("INSERT IGNORE INTO photo_likes (photo_id, visitor_hash) VALUES (?, ?)", [photoId, visitor]); }
    catch { throw new HttpError(404, "照片不存在。 "); }
  } else await getDatabase().execute("DELETE FROM photo_likes WHERE photo_id = ? AND visitor_hash = ?", [photoId, visitor]);
  return getLike(photoId);
}
