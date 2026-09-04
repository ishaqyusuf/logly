import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

const projectParamsSchema = {
  projectId: parseAsString,
  projectType: parseAsStringEnum(["create", "details"]),
};

export function useProjectParams() {
  const [params, setParams] = useQueryStates(projectParamsSchema);
  return { ...params, setParams };
}
