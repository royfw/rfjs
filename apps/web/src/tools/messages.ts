import type { LocaleMessages } from "./types";

import { messages as dataFilterBuilder } from "./data-filter-builder/messages";
import { messages as dataFilterTester } from "./data-filter-tester/messages";
import { messages as formBuilder } from "./form-builder/messages";
import { messages as bpmnViewer } from "./bpmn-viewer/messages";
import { messages as flowBuilder } from "./flow-builder/messages";
import { messages as decisionTable } from "./decision-table/messages";
import { messages as tableBuilder } from "./table-builder/messages";
import { messages as esClientDemo } from "./es-client-demo/messages";
import { messages as esQueryBuilder } from "./es-query-builder/messages";
import { messages as jsonbQueryBuilder } from "./jsonb-query-builder/messages";
import { messages as jsonbQueryGenerator } from "./jsonb-query-generator/messages";
import { messages as jwtDecoder } from "./jwt-decoder/messages";
import { messages as metadataBuilder } from "./metadata-builder/messages";
import { messages as mongoQueryBuilder } from "./mongo-query-builder/messages";
import { messages as mongoQueryGenerator } from "./mongo-query-generator/messages";
import { messages as objectFlatten } from "./object-flatten/messages";
import { messages as pgFilterBuilder } from "./pg-filter-builder/messages";
import { messages as sqlFilterBuilder } from "./sql-filter-builder/messages";
import { messages as typeConverter } from "./type-converter/messages";

// As each tool is migrated, add its messages fragment here (i18n only, no component import).
export const toolMessages: LocaleMessages[] = [
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
  metadataBuilder,
];
