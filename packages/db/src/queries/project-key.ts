import { and, eq } from "drizzle-orm";
import { getDatabase } from "../client";
import {
  analyticsOrganizations,
  analyticsProjectKeys,
  analyticsProjects,
} from "../schema";
import {
  createProjectCredential,
  hashCredential,
  type ProjectKeyScope,
} from "./credential";

export type IssueProjectKeyInput = {
  organization: string;
  project: string;
  scope: ProjectKeyScope;
};

export async function issueAnalyticsProjectKey(input: IssueProjectKeyInput) {
  const db = getDatabase();
  if (!db) throw new Error("Database is required to issue a project key");
  return db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ id: analyticsProjects.id, name: analyticsProjects.name })
      .from(analyticsProjects)
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(
        and(
          eq(analyticsProjects.slug, input.project),
          eq(analyticsOrganizations.slug, input.organization),
          eq(analyticsProjects.enabled, true),
        ),
      )
      .limit(1)
      .for("share");
    if (!project) return null;
    const value = createProjectCredential(input.scope);
    await transaction.insert(analyticsProjectKeys).values({
      projectId: project.id,
      name: `${project.name} ${input.scope}`,
      scope: input.scope,
      keyHash: hashCredential(value),
    });
    return { scope: input.scope, value };
  });
}
