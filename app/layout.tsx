import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "拾光 · 私人影像集", template: "%s · 拾光" },
  description: "收藏光经过的地方，用相片记下日常、远方和那些不想忘记的瞬间。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
