import type { ToolModule } from "@/tools/types";

import { FlowBuilderTool } from "./ui";

export const tool: ToolModule = { id: "flow-builder", Component: FlowBuilderTool };
