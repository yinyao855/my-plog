import { requireAdmin } from "@/lib/auth";
import { deleteAlbum, updateAlbum } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin, readJsonBody } from "@/lib/http";

export async function PATCH(request: Request, context: RouteContext<"/api/albums/[id]">) {
  try {
    assertSameOrigin(request); await requireAdmin();
    const body = await readJsonBody(request);
    if (!body || typeof body !== "object") throw new Error();
    const { id } = await context.params;
    return Response.json({ album: await updateAlbum(id, body as { title: string; description: string; visibility: unknown }) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: RouteContext<"/api/albums/[id]">) {
  try { assertSameOrigin(request); await requireAdmin(); const { id } = await context.params; await deleteAlbum(id); return new Response(null, { status: 204 }); }
  catch (error) { return apiError(error); }
}
