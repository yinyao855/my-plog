import { getAdminConfig } from "@/config/admin";
import { startAdminSession } from "@/lib/auth";
import { sameString, verifyPassword } from "@/lib/auth/crypto";
import { loginRateLimiter } from "@/lib/auth/rate-limit";
import { apiError, assertSameOrigin, HttpError, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const config = getAdminConfig();
    if (!config) throw new HttpError(503, "管理员账号尚未配置，请先完成站点配置。");
    const body = await readJsonBody(request, 4096);
    if (!body || typeof body !== "object" || !("username" in body) || !("password" in body)
      || typeof body.username !== "string" || typeof body.password !== "string"
      || !body.username.trim() || body.username.length > 80 || !body.password
      || Buffer.byteLength(body.password, "utf8") > 1024) throw new HttpError(400, "请输入有效的账号和密码。");
    const username = body.username.trim();
    const retryAfter = loginRateLimiter.consume(username);
    if (retryAfter) {
      return Response.json({ error: "尝试次数较多，请稍后再登录。" }, {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      });
    }
    // Always derive the password, even when the username is incorrect.
    const validPassword = await verifyPassword(body.password, config.passwordHash);
    if (!validPassword || !sameString(username, config.username)) throw new HttpError(401, "账号或密码不正确。");
    await startAdminSession();
    return Response.json({ admin: { username: config.username } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
