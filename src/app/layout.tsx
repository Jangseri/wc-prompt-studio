import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "WC Prompt Studio",
  description: "AI 콜봇/챗봇 프롬프트 자동 생성 및 관리 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#18181b",
              border: "1px solid #27272a",
              color: "#fafafa",
            },
          }}
        />
      </body>
    </html>
  );
}
