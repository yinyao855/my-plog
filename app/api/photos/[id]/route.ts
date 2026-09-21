import { requireAdmin } from "@/lib/auth";
import { deletePhoto } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin } from "@/lib/http";
import { removeUpload } from "@/lib/uploads";

export async function DELETE(request: Request, context: RouteContext<"/api/photos/[id]">) {
  try { assertSameOrigin(request); await requireAdmin(); const { id } = await context.params; const { storageKey } = await deletePhoto(id); await removeUpload(storageKey); return new Response(null, { status: 204 }); }
  catch (error) { return apiError(error); }
}
