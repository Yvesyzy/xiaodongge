import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "私人音乐感受档案",
  description: "长期记录音乐感受、专辑记忆、歌曲触动和年度总结的本地网页应用。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
