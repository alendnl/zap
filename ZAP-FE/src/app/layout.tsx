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
      <body className="h-screen w-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 antialiased overflow-hidden transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
