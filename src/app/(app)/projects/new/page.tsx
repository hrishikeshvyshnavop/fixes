import { requireUser } from "@/lib/auth";
import { NewProjectForm } from "@/components/new-project-form";
import { isProjectType } from "@/lib/project-types";

// Direct loads / refreshes of /projects/new render the same form inside the app panel.
export default async function NewProject({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const user = await requireUser();
  return (
    <div className="mx-auto flex h-full w-full max-w-[880px] flex-col">
      <NewProjectForm user={{ name: user.name }} variant="page" initialType={isProjectType(type) ? type : undefined} />
    </div>
  );
}
