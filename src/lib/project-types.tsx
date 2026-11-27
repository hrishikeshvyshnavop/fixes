import { AppWindow, FileText, Globe, Image, Smartphone, type LucideIcon } from "lucide-react";

export const PROJECT_TYPES = ["website", "webapp", "mobile", "image", "pdf"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const TYPE_META: Record<ProjectType, { label: string; Icon: LucideIcon; hint: string }> = {
  website: { label: "Website", Icon: Globe, hint: "Marketing sites, landing pages, blogs" },
  webapp: { label: "Web app", Icon: AppWindow, hint: "Dashboards and logged-in products" },
  mobile: { label: "Mobile", Icon: Smartphone, hint: "iOS / Android app reviews" },
  image: { label: "Image", Icon: Image, hint: "Mockups, designs, screenshots" },
  pdf: { label: "PDF", Icon: FileText, hint: "Documents, decks, proofs" },
};

export const isProjectType = (v: unknown): v is ProjectType => PROJECT_TYPES.includes(v as ProjectType);

/** The script-tag widget only works on web pages. */
export const supportsWidget = (t: string) => t === "website" || t === "webapp";
