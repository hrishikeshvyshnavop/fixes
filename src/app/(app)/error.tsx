"use client";

import { AppError } from "@/components/app-error";

// Errors inside the signed-in area render here, keeping the sidebar.
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppError {...props} />;
}
