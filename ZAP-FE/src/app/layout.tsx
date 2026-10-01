import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZAP — Technical Interview Platform",
  description: "Next-generation DSA and interview preparation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-slate-950 text-slate-50 antialiased overflow-hidden">{children}</body>
    </html>
  );
}
