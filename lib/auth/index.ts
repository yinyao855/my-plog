import "server-only";

import { cookies } from "next/headers";
import { getAdminConfig } from "@/config/admin";
import { HttpError } from "@/lib/http";
import { createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from "./crypto";

export type AdminSession = { username: string };

const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-lumen_admin" : "lumen_admin";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export function isAdminConfigured(): boolean {
  return getAdminConfig() !== null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const config = getAdminConfig();
  const token = cookieStore.get(cookieName())?.value;
  return config && token ? verifySessionToken(token, config) : null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new HttpError(401, "请先登录管理员账号。");
  return session;
}

export async function startAdminSession(): Promise<void> {
  const config = getAdminConfig();
  if (!config) throw new HttpError(503, "管理员账号尚未配置，请先完成站点配置。");
  (await cookies()).set(cookieName(), createSessionToken(config), {
    ...cookieOptions(),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).set(cookieName(), "", { ...cookieOptions(), maxAge: 0 });
}
