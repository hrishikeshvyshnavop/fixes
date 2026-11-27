import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser, safeNext } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getUser()) redirect(safeNext(next));
  return <AuthForm mode="login" next={next ? safeNext(next) : undefined} error={error} />;
}
