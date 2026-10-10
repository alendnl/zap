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
      <body className="min-h-screen bg-[#f6f8fa] dark:bg-[#0d1117] text-[#1f2328] dark:text-[#e6edf3] antialiased selection:bg-blue-500/20">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
