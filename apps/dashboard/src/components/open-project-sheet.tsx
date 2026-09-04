"use client";

import { Button } from "@logly/ui/button";
import { Plus } from "lucide-react";
import { useProjectParams } from "@/hooks/use-project-params";

export function OpenProjectSheet() {
  const { setParams } = useProjectParams();
  return (
    <Button onClick={() => void setParams({ projectType: "create" })}>
      <Plus className="h-4 w-4" />
      Connect project
    </Button>
  );
}
