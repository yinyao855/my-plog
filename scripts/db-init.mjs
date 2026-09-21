import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL?.trim()) {
  console.error("请先在 .env.local 中配置 DATABASE_URL，并创建一个空的 MySQL 8 数据库。");
  process.exitCode = 1;
} else {
  let connection;
  try {
    connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: false });
    const [columns] = await connection.execute(
      "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'albums' AND COLUMN_NAME = 'id'",
    );
    if (columns.length && columns[0].DATA_TYPE !== "char") {
      throw new Error("检测到旧版示例结构；初始化已停止。请备份原数据库，并为当前版本创建一个新数据库。");
    }
    const schema = await readFile(fileURLToPath(new URL("../database/schema.sql", import.meta.url)), "utf8");
    const statements = schema.replace(/^--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await connection.query(statement);
    console.log("MySQL 数据表初始化完成。已有的数据不会被删除。");
  } catch (error) {
    console.error(error instanceof Error ? `初始化失败：${error.message}` : "数据库初始化失败。");
    process.exitCode = 1;
  } finally {
    await connection?.end();
  }
}
