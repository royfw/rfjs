import type { ToolModule } from "@/tools/types";

import { MetadataBuilderTool } from "./ui";

export const tool: ToolModule = { id: "metadata-builder", Component: MetadataBuilderTool };
