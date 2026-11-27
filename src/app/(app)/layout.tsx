import { MobileBar, Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";

// Signed-in area. Sidebar counts are live, so render per request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Sidebar user={user} />
      <MobileBar />
      <main className="min-h-0 min-w-0 flex-1 md:py-2 md:pr-2">
        <div className="flex h-full flex-col overflow-hidden bg-background md:rounded-lg md:border md:border-border md:shadow-xs">
          {children}
        </div>
      </main>
      {modal}
    </div>
  );
}
