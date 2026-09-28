# 拾光

拾光是一个单用户、自托管的个人摄影相册。访客可以浏览公开相册、点赞、评论及分享；只有配置文件中的管理员能够登录、创建相册、上传和删除照片，以及调整公开范围。

## 技术选型

- Next.js 16 App Router、React 19、Tailwind CSS 4
- MySQL 8：相册、照片、评论和去重点赞
- Node `crypto`：配置驱动的单管理员登录，不依赖第三方身份服务
- Sharp：验证图片、自动校正方向、移除 EXIF 并输出 WebP

## 本地启动

需要 Node.js 22.6+、pnpm 12 和 MySQL 8。

```bash
pnpm install
cp .env.example .env.local
pnpm password:hash
```

最后一条命令会交互式生成 `ADMIN_PASSWORD_HASH` 与 `SESSION_SECRET`。将输出复制到 `.env.local`，同时设置一个非空的 `ADMIN_USERNAME`。不要把 `.env.local` 提交到 Git。

管理员密码最少为 6 个字符。即使是个人站点，也建议使用更长且不与其他服务重复的密码。

创建空数据库并初始化表结构：

```bash
mysql -u root -p -e 'CREATE DATABASE lumen CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
pnpm db:init
pnpm dev
```

打开 `http://localhost:3000` 浏览公开相册，访问 `http://localhost:3000/login` 进入管理员登录页。尚未配置数据库时，首页会展示只读示例照片；创建、上传等写入功能会明确提示需要完成配置。

## 管理员配置

管理员只来自环境变量，不存入数据库：

| 变量 | 作用 |
| --- | --- |
| `ADMIN_USERNAME` | 管理员登录名 |
| `ADMIN_PASSWORD_HASH` | `pnpm password:hash` 生成的 scrypt 哈希 |
| `SESSION_SECRET` | 签名会话的随机密钥，至少 32 字节 |
| `APP_URL` | 部署后的完整站点地址，用于校验所有写请求来源 |
| `DATABASE_URL` | MySQL 连接字符串 |
| `DATABASE_SSL` | 远程数据库是否启用 TLS，远程连接建议设为 `true` |
| `DATABASE_SSL_CA` | 可选，数据库服务商提供的 CA 证书绝对路径 |
| `UPLOAD_DIR` | 照片存储目录，必须位于 `public/` 外 |

登录会话使用签名的 `HttpOnly` Cookie，有效期八小时。改动密码哈希或 `SESSION_SECRET` 会立即使已登录会话失效。登录接口有进程内限流；在多实例部署时，请在反向代理或 Redis 层追加共享限流。

## 连接远程 MySQL

可以直接连接服务器或云数据库，把 `DATABASE_URL` 中的主机改为远程地址即可：

```dotenv
DATABASE_URL="mysql://lumen:经过URL编码的密码@db.example.com:3306/lumen"
DATABASE_SSL="true"
```

用户名或密码中的 `@`、`:`、`/`、`#` 等字符必须进行 URL 编码。远程 MySQL 需要允许应用服务器访问 3306 端口，并给 `lumen` 用户授予目标数据库的最小读写权限；不要将数据库端口向整个互联网开放。云数据库要求自定义 CA 时，下载服务商的 CA 文件并配置 `DATABASE_SSL_CA`。运行 `pnpm db:init` 的机器也必须能访问该远程数据库。

## 数据与照片

数据库结构位于 [database/schema.sql](database/schema.sql)。初始化脚本只创建缺失的数据表，绝不删除已有数据；如果检测到旧示例版本的表结构，它会停止执行。

上传的文件会限制为 10MB 的静态 JPG、PNG 或 WebP，解码后去除元数据、压缩为 WebP 并保存在 `UPLOAD_DIR`。文件不放入 `public/`；私密相册的图片会在媒体路由上再次检查管理员会话。

部署时请同时备份 MySQL 和 `UPLOAD_DIR`。删除相册会级联删除其数据库记录；目前关联的物理图片保留在上传目录中，便于从备份恢复或人工清理，避免数据库操作中断造成不可恢复的数据丢失。

## 验证

```bash
pnpm lint
pnpm test:auth
pnpm exec next build --webpack
```

默认的 `next build` 使用 Turbopack；若本机环境禁止其 CSS 子进程绑定端口，可使用上面的 Webpack 构建命令。

## 开源许可

代码发布前请加入许可证文件。MIT 是应用代码的常见选择；照片作品应单独声明版权和授权范围。
