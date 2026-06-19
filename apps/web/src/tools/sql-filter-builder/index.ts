import type { ToolModule } from "@/tools/types";

import { SqlFilterBuilder } from "./ui";

export const tool: ToolModule = { id: "sql-filter-builder", Component: SqlFilterBuilder };
