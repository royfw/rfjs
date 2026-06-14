import type { ComponentType } from "react";

import { DataFilterTester } from "./data-filter-tester";
import { JsonbQueryGenerator } from "./jsonb-query-generator";
import { JwtDecoder } from "./jwt-decoder";
import { MongoQueryGenerator } from "./mongo-query-generator";
import { ObjectFlatten } from "./object-flatten";
import { TypeConverter } from "./type-converter";

// Web quick tools with a live implementation. Tool ids absent here render the
// "coming soon" placeholder on /tools/[slug].
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "type-converter": TypeConverter,
  "object-flatten": ObjectFlatten,
  "data-filter-tester": DataFilterTester,
  "mongo-query-generator": MongoQueryGenerator,
  "jsonb-query-generator": JsonbQueryGenerator,
  "jwt-decoder": JwtDecoder,
};
