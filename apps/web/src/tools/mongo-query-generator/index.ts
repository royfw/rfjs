import type { ToolModule } from "@/tools/types";

import { MongoQueryGenerator } from "./ui";

export const tool: ToolModule = { id: "mongo-query-generator", Component: MongoQueryGenerator };
