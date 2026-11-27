export const dynamic = "force-dynamic";

// Centered, chrome-free screen for login / sign-up / invite pages. Each page brings its own logo.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
