import type { ToolModule } from "@/tools/types";

import { TableBuilderTool } from "./ui";

export const tool: ToolModule = { id: "table-builder", Component: TableBuilderTool };
