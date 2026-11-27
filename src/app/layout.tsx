import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { themeScript } from "./theme-toggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fixes · Website feedback",
  description: "Collect pinned, visual feedback on any website.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark by default; the inline script sets the final class before paint, so React ignores the diff.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        {/* Feedback on Fixes itself, via the "Fixes" project (allowed: fixes-six.vercel.app and localhost:3001).
            Local dev loads this server's own widget build so widget changes show up immediately.
            Preview deployments are skipped: their URLs aren't in the allowed list. */}
        {(process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "development") && (
          <Script
            src={process.env.VERCEL_ENV === "production" ? "https://fixes-six.vercel.app/widget.js" : "/widget.js"}
            data-key="pk_2YnBCfcU0LTkrXen"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
