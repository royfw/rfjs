import type { ToolModule } from "@/tools/types";

import { BpmnViewerTool } from "./ui";

export const tool: ToolModule = { id: "bpmn-viewer", Component: BpmnViewerTool };
