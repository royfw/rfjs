import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "@rfjs/web-core";

import { isExternalTool, toolHref } from "./tool-href";

const webTool: ToolDefinition = {
  id: "jwt-decoder",
  category: "inspect",
  surface: "web",
  status: "planned",
};
const wbApp: ToolDefinition = {
  id: "data-filter-builder",
  category: "filter",
  surface: "workbench",
  status: "planned",
};

describe("toolHref", () => {
  it("web tools link internally by id", () => {
    expect(toolHref(webTool)).toBe("/tools/jwt-decoder");
    expect(isExternalTool(webTool)).toBe(false);
  });

  it("workbench apps link cross-site under /apps", () => {
    expect(toolHref(wbApp)).toContain("/apps/data-filter-builder");
    expect(isExternalTool(wbApp)).toBe(true);
  });
});
