import type { ToolModule } from "@/tools/types";

import { DecisionTableTool } from "./ui";

export const tool: ToolModule = { id: "decision-table", Component: DecisionTableTool };
