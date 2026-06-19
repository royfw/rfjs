import type { ComponentType } from "react";

import type { ToolModule } from "./types";

import { tool as dataFilterBuilder } from "./data-filter-builder";
import { tool as dataFilterTester } from "./data-filter-tester";
import { tool as jsonbQueryBuilder } from "./jsonb-query-builder";
import { tool as jsonbQueryGenerator } from "./jsonb-query-generator";
import { tool as jwtDecoder } from "./jwt-decoder";
import { tool as mongoQueryBuilder } from "./mongo-query-builder";
import { tool as mongoQueryGenerator } from "./mongo-query-generator";
import { tool as objectFlatten } from "./object-flatten";
import { tool as queryBuilder } from "./query-builder";
import { tool as sqlFilterBuilder } from "./sql-filter-builder";
import { tool as typeConverter } from "./type-converter";

// As each tool is migrated, add its descriptor to this array.
export const toolModules: ToolModule[] = [
  typeConverter,
  objectFlatten,
  dataFilterTester,
  mongoQueryGenerator,
  jsonbQueryGenerator,
  jwtDecoder,
  queryBuilder,
  dataFilterBuilder,
  jsonbQueryBuilder,
  sqlFilterBuilder,
  mongoQueryBuilder,
];

export const TOOL_COMPONENTS: Record<string, ComponentType> = Object.fromEntries(
  toolModules.map((t) => [t.id, t.Component]),
);
