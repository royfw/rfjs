import type { LocaleMessages } from "./types";

import { messages as dataFilterTester } from "./data-filter-tester/messages";
import { messages as jsonbQueryGenerator } from "./jsonb-query-generator/messages";
import { messages as jwtDecoder } from "./jwt-decoder/messages";
import { messages as mongoQueryGenerator } from "./mongo-query-generator/messages";
import { messages as objectFlatten } from "./object-flatten/messages";
import { messages as typeConverter } from "./type-converter/messages";

// As each tool is migrated, add its messages fragment here (i18n only, no component import).
export const toolMessages: LocaleMessages[] = [
  typeConverter,
  objectFlatten,
  dataFilterTester,
  mongoQueryGenerator,
  jsonbQueryGenerator,
  jwtDecoder,
];
