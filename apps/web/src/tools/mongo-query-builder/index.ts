import type { ToolModule } from "@/tools/types";

import { MongoQueryBuilder } from "./ui";

export const tool: ToolModule = { id: "mongo-query-builder", Component: MongoQueryBuilder };
