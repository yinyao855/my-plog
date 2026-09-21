import { getAdminSession } from "@/lib/auth";
import { getPhotoVisibilityByStorageKey } from "@/lib/gallery-repository";
import { apiError, HttpError } from "@/lib/http";
import { isStorageKey, readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/media/[key]">) {
  try {
    const { key } = await context.params;
    if (!isStorageKey(key)) throw new HttpError(404, "照片不存在。");
    const visibility = await getPhotoVisibilityByStorageKey(key);
    if (!visibility) throw new HttpError(404, "照片不存在。");
    if (visibility === "PRIVATE" && !(await getAdminSession())) throw new HttpError(404, "照片不存在。");
    const image = await readUpload(key);
    return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/webp", "Cache-Control": visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
