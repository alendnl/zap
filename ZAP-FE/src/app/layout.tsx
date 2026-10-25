import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "ZAP — Technical Interview & Programming Platform",
  description: "Next-generation DSA, technical interview, and coding playground platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] antialiased selection:bg-blue-500/20 font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

