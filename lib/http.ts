export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  // Do not expose database messages, paths, credentials, or stack traces to visitors.
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "操作暂时未能完成，请稍后再试。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

/** All browser mutations require an exact Origin match, including login and logout. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(process.env.APP_URL || request.url).origin;
    if (!/^https?:\/\//.test(allowedOrigin)) throw new Error("Unsupported origin");
  } catch {
    throw new HttpError(503, "站点地址配置无效，请联系站点管理员。");
  }
  if (!origin || origin !== allowedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "请求来源无效，请从本站页面重新操作。");
  }
}

/** Bound streamed bodies too: Content-Length alone is absent for chunked requests. */
export async function readJsonBody(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase().endsWith("/json")) {
    throw new HttpError(415, "请求需要使用 JSON 格式。");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容不能为空。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "请求内容过长。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "请求内容格式不正确。");
  }
}
