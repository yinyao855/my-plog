import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ admin: await getAdminSession() }, { headers: { "Cache-Control": "no-store" } });
}
