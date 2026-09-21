import { requireAdmin } from "@/lib/auth";
import { createAlbum } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin, readJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); await requireAdmin();
    const body = await readJsonBody(request);
    if (!body || typeof body !== "object") throw new Error();
    return Response.json({ album: await createAlbum(body as { title: string; description: string; visibility: unknown }) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
