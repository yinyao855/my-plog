import { requireAdmin } from "@/lib/auth";
import { createPhoto } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin } from "@/lib/http";
import { readUploadForm, removeUpload, saveUpload } from "@/lib/uploads";

export async function POST(request: Request, context: RouteContext<"/api/albums/[id]/photos">) {
  let key: string | undefined;
  try {
    assertSameOrigin(request); await requireAdmin();
    const { id: albumId } = await context.params; const form = await readUploadForm(request);
    const file = form.get("file"); if (!(file instanceof File)) throw new Error("请选择一张照片。");
    const stored = await saveUpload(file); key = stored.key;
    const photo = await createPhoto({ albumId, storageKey: stored.key, width: stored.width, height: stored.height, title: String(form.get("title") || ""), description: String(form.get("description") || ""), location: String(form.get("location") || "") });
    return Response.json({ photo }, { status: 201 });
  } catch (error) { if (key) await removeUpload(key); return apiError(error); }
}
