"use client";

import { AppError } from "@/components/app-error";
import "./globals.css";

// Last-resort boundary (e.g. a layout chunk failed to load). Replaces the whole document.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <AppError {...props} />
      </body>
    </html>
  );
}
