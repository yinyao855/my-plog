import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { HttpError } from "@/lib/http";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const storageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

function uploadDirectory(): string {
  const directory = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"));
  const publicDirectory = path.join(process.cwd(), "public");
  if (directory === publicDirectory || directory.startsWith(`${publicDirectory}${path.sep}`)) {
    throw new HttpError(503, "照片存储目录必须位于 public 目录之外。");
  }
  return directory;
}

export function isStorageKey(value: string): boolean {
  return storageKeyPattern.test(value);
}

function storagePath(key: string): string {
  if (!isStorageKey(key)) throw new HttpError(404, "照片不存在。");
  return path.join(uploadDirectory(), key);
}

/** Cap the actual stream, including chunked requests without Content-Length. */
export async function readUploadForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;")) throw new HttpError(415, "请使用照片上传表单。");
  if (Number(request.headers.get("content-length")) > MAX_MULTIPART_BYTES) throw new HttpError(413, "每张照片不能超过 10 MB。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请选择一张照片。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "每张照片不能超过 10 MB。");
      }
      chunks.push(value);
    }
    const data = Buffer.concat(chunks);
    return await new Response(data, { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "上传内容无法读取，请重新选择照片。");
  } finally {
    reader.releaseLock();
  }
}

/** Decode, orient and re-encode to strip metadata, filenames and embedded content. */
export async function saveUpload(file: File): Promise<{ key: string; width: number; height: number }> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "照片文件不能为空，且不能超过 10 MB。");
  const input = Buffer.from(await file.arrayBuffer());
  let output;
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) {
      throw new HttpError(415, "仅支持静态 JPG、PNG 或 WebP 照片。");
    }
    output = await image.rotate().resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "照片无法解码，请检查文件是否完整，且像素不超过 5000 万。");
  }
  const key = `${randomUUID()}.webp`;
  await mkdir(uploadDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(storagePath(key), output.data, { flag: "wx", mode: 0o600 });
  return { key, width: output.info.width, height: output.info.height };
}

export async function readUpload(key: string): Promise<Buffer> {
  try {
    return await readFile(storagePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "照片文件不存在。");
    throw error;
  }
}

/** Called only after deleting DB references, or when an insert fails. */
export async function removeUpload(key: string): Promise<void> {
  try {
    await unlink(storagePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // A retained orphan is safer than rolling back a committed database deletion.
      console.error("[lumen] 无法清理照片文件", key, (error as NodeJS.ErrnoException).code);
    }
  }
}
