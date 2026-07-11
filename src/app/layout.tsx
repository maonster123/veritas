import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnnouncementBanner from "@/components/AnnouncementBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Veritas — 智能论文写作助手 | AI Academic Writing",
    template: "%s | Veritas",
  },
  description:
    "免费在线论文写作工具，AI 辅助生成论文大纲、管理参考文献、格式化引用。支持 APA 7th、MLA 9th、IEEE、NLM、GB/T 7714 等主流格式。中英双语写作。",
  keywords: [
    "论文写作",
    "论文大纲",
    "AI写作",
    "学术写作",
    "参考文献管理",
    "引用格式化",
    "APA",
    "MLA",
    "GB/T 7714",
    "academic writing",
    "thesis outline",
    "citation formatter",
  ],
  authors: [{ name: "冬瓜写作" }],
  creator: "Veritas",
  publisher: "冬瓜写作",
  metadataBase: new URL("https://www.dongguawriting.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://www.dongguawriting.com",
    siteName: "Veritas — 智能论文写作助手",
    title: "Veritas — AI 论文写作助手 | 智能大纲 & 文献管理",
    description:
      "免费在线论文写作工具，AI 辅助生成大纲、管理参考文献、格式化引用。中英双语支持。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Veritas 论文写作助手",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veritas — AI 论文写作助手",
    description:
      "免费在线论文写作工具，AI 辅助生成大纲、管理参考文献、格式化引用。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AnnouncementBanner />
        {children}
      </body>
    </html>
  );
}
