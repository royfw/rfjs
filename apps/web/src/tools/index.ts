import type { ComponentType } from "react";

import type { ToolModule } from "./types";

import { tool as objectFlatten } from "./object-flatten";
import { tool as typeConverter } from "./type-converter";

// As each tool is migrated, add its descriptor to this array.
export const toolModules: ToolModule[] = [typeConverter, objectFlatten];

export const TOOL_COMPONENTS: Record<string, ComponentType> = Object.fromEntries(
  toolModules.map((t) => [t.id, t.Component]),
);
