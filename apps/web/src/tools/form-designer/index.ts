import type { ToolModule } from "@/tools/types";

import { FormDesignerTool } from "./ui";

export const tool: ToolModule = { id: "form-designer", Component: FormDesignerTool };
