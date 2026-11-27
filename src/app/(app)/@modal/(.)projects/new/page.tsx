import { requireUser } from "@/lib/auth";
import { NewProjectModal } from "@/components/modal";
import { isProjectType } from "@/lib/project-types";

// Intercepts client-side navigations to /projects/new and shows it as a modal over the current page.
export default async function NewProjectInterceptedModal({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const user = await requireUser();
  return <NewProjectModal user={{ name: user.name }} initialType={isProjectType(type) ? type : undefined} />;
}
