import type { ComponentType } from "react";

import { ObjectFlatten } from "./object-flatten";
import { TypeConverter } from "./type-converter";

// Web quick tools with a live implementation. Tool ids absent here render the
// "coming soon" placeholder on /tools/[slug].
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "type-converter": TypeConverter,
  "object-flatten": ObjectFlatten,
};
