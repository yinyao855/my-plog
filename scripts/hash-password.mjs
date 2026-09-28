#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/auth/crypto.ts";

/** Hidden terminal input keeps the password out of shell history and process arguments. */
async function readPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("请在交互式终端运行此命令，密码不会显示在屏幕上。");
  }
  process.stdout.write(prompt);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onData(data) {
      for (const character of data) {
        if (character === "\u0003" || character === "\u0004") { finish(new Error("操作已取消。")); return; }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\u007f" || character === "\b") value = [...value].slice(0, -1).join("");
        else if (character >= " ") value += character;
        if (Buffer.byteLength(value, "utf8") > 1024) { finish(new Error("密码不能超过 1024 字节。")); return; }
      }
    }
    process.stdin.on("data", onData);
  });
}

try {
  const password = await readPassword("设置管理员密码（至少 6 个字符，输入不会显示）：");
  const confirmation = await readPassword("再次输入密码：");
  if (password !== confirmation) throw new Error("两次输入的密码不一致。");
  const passwordHash = await hashPassword(password);
  console.log("\n将以下内容填入 .env.local，并另外设置 ADMIN_USERNAME。请勿提交真实配置。\n");
  console.log(`ADMIN_PASSWORD_HASH="${passwordHash}"`);
  console.log(`SESSION_SECRET="${randomBytes(32).toString("hex")}"`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "无法生成密码配置。");
  process.exitCode = 1;
}
