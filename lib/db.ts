import "server-only";
import { readFileSync } from "node:fs";
import mysql, { type Pool } from "mysql2/promise";
import { HttpError } from "@/lib/http";

const globalDatabase = globalThis as typeof globalThis & { lumenPool?: Pool };

function sslOptions(): { rejectUnauthorized: true; ca?: string } | undefined {
  if (process.env.DATABASE_SSL !== "true") return undefined;
  const caPath = process.env.DATABASE_SSL_CA?.trim();
  return caPath ? { rejectUnauthorized: true, ca: readFileSync(caPath, "utf8") } : { rejectUnauthorized: true };
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabase(): Pool {
  const uri = process.env.DATABASE_URL?.trim();
  if (!uri) throw new HttpError(503, "当前为只读演示模式，请先配置 MySQL 数据库后再操作。");
  if (!globalDatabase.lumenPool) {
    globalDatabase.lumenPool = mysql.createPool({
      uri, connectionLimit: 10, waitForConnections: true, queueLimit: 100,
      connectTimeout: 10000, timezone: "Z", charset: "utf8mb4", multipleStatements: false,
      ssl: sslOptions(),
    });
  }
  return globalDatabase.lumenPool;
}
