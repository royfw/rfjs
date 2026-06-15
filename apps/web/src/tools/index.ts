import type { ComponentType } from "react";

import type { ToolModule } from "./types";

// As each tool is migrated, add its descriptor to this array.
export const toolModules: ToolModule[] = [];

export const TOOL_COMPONENTS: Record<string, ComponentType> = Object.fromEntries(
  toolModules.map((t) => [t.id, t.Component]),
);
