import { slugifyProjectName } from "./project-input";

export type CreateOrganizationInput = {
  name: string;
  slug: string;
};

export function parseCreateOrganizationInput(
  value: unknown,
):
  | { success: true; data: CreateOrganizationInput }
  | { success: false; error: string } {
  if (!value || typeof value !== "object") {
    return { success: false, error: "Invalid organization payload" };
  }

  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = slugifyProjectName(name);
  if (name.length < 2 || name.length > 80) {
    return {
      success: false,
      error: "Organization name must be 2–80 characters",
    };
  }
  if (!slug) {
    return {
      success: false,
      error: "Organization name must produce a valid lowercase slug",
    };
  }
  return { success: true, data: { name, slug } };
}
