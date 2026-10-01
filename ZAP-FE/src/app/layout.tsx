import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZAP Faculty Portal",
  description: "Question management portal for ZAP faculty",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}
