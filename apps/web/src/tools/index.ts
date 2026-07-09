import type { ComponentType } from "react";

import type { ToolModule } from "./types";

import { tool as dataFilterBuilder } from "./data-filter-builder";
import { tool as dataFilterTester } from "./data-filter-tester";
import { tool as formBuilder } from "./form-builder";
import { tool as bpmnViewer } from "./bpmn-viewer";
import { tool as flowBuilder } from "./flow-builder";
import { tool as decisionTable } from "./decision-table";
import { tool as tableBuilder } from "./table-builder";
import { tool as esClientDemo } from "./es-client-demo";
import { tool as esQueryBuilder } from "./es-query-builder";
import { tool as jsonbQueryBuilder } from "./jsonb-query-builder";
import { tool as jsonbQueryGenerator } from "./jsonb-query-generator";
import { tool as jwtDecoder } from "./jwt-decoder";
import { tool as mongoQueryBuilder } from "./mongo-query-builder";
import { tool as mongoQueryGenerator } from "./mongo-query-generator";
import { tool as objectFlatten } from "./object-flatten";
import { tool as pgFilterBuilder } from "./pg-filter-builder";
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
  dataFilterBuilder,
  jsonbQueryBuilder,
  sqlFilterBuilder,
  mongoQueryBuilder,
  esQueryBuilder,
  esClientDemo,
  pgFilterBuilder,
  formBuilder,
  bpmnViewer,
  flowBuilder,
  decisionTable,
  tableBuilder,
];

export const TOOL_COMPONENTS: Record<string, ComponentType> = Object.fromEntries(
  toolModules.map((t) => [t.id, t.Component]),
);
