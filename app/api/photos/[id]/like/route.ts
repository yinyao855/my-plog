import { getLike, requirePublicPhoto, setLike } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin, readJsonBody } from "@/lib/http";

export async function GET(_request: Request, context: RouteContext<"/api/photos/[id]/like">) {
  try { const { id } = await context.params; await requirePublicPhoto(id); return Response.json(await getLike(id), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/photos/[id]/like">) {
  try { assertSameOrigin(request); const body = await readJsonBody(request); if (!body || typeof body !== "object" || typeof (body as { liked?: unknown }).liked !== "boolean") throw new Error(); const { id } = await context.params; await requirePublicPhoto(id); return Response.json(await setLike(id, (body as { liked: boolean }).liked)); } catch (error) { return apiError(error); }
}
