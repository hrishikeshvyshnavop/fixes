import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser, safeNext } from "@/lib/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const { next, email } = await searchParams;
  if (await getUser()) redirect(safeNext(next));
  return <AuthForm mode="signup" next={next ? safeNext(next) : undefined} email={email} />;
}
