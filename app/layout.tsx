import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import NoticeBand from "@/components/NoticeBand";

export const metadata: Metadata = {
  title: {
    default: "PansaWatch — 대한민국 법관 정보 공개 기록",
    template: "%s · PansaWatch",
  },
  description:
    "공개된 뉴스·판례를 자동 수집·정리해 시민이 법관 정보를 열람하도록 돕는 비영리 시빅테크 기록물입니다.",
  applicationName: "PansaWatch",
  authors: [{ name: "PansaWatch" }],
  metadataBase: new URL("https://pansawatch.org"),
  openGraph: {
    title: "PansaWatch — 대한민국 법관 정보 공개 기록",
    description:
      "공개 뉴스·판례 자동 수집·정리. 운영자 의견 미게재. 비영리 시빅테크 프로젝트.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-navy-900">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-navy-900 focus:text-white focus:px-3 focus:py-2 focus:text-sm focus:rounded"
        >
          본문으로 건너뛰기
        </a>
        <NoticeBand />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
