import { addComment, getComments, requirePublicPhoto } from "@/lib/gallery-repository";
import { apiError, assertSameOrigin, readJsonBody } from "@/lib/http";

export async function GET(_request: Request, context: RouteContext<"/api/photos/[id]/comments">) {
  try { const { id } = await context.params; await requirePublicPhoto(id); return Response.json({ comments: await getComments(id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/photos/[id]/comments">) {
  try { assertSameOrigin(request); const body = await readJsonBody(request); if (!body || typeof body !== "object") throw new Error(); const { id } = await context.params; await requirePublicPhoto(id); const values = body as { author: string; body: string }; return Response.json({ comment: await addComment(id, values.author, values.body) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
