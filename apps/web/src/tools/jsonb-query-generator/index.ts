import type { ToolModule } from "@/tools/types";

import { JsonbQueryGenerator } from "./ui";

export const tool: ToolModule = { id: "jsonb-query-generator", Component: JsonbQueryGenerator };
