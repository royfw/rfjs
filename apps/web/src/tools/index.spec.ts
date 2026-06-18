import { toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { TOOL_COMPONENTS, toolModules } from "./index";
import { toolMessages } from "./messages";
import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import zhTW from "@/messages/zh-TW.json";

const EXPECTED_WEB_TOOL_IDS = [
  "type-converter",
  "object-flatten",
  "data-filter-tester",
  "mongo-query-generator",
  "jsonb-query-generator",
  "jwt-decoder",
  "query-builder",
  "data-filter-builder",
].sort();

describe("implementation registry", () => {
  it("registers exactly the expected web tools", () => {
    expect(toolModules.map((t) => t.id).sort()).toEqual(EXPECTED_WEB_TOOL_IDS);
  });

  it("every registered component id exists in the web-core catalog", () => {
    const catalogIds = new Set(toolRegistry.map((t) => t.id));
    for (const id of Object.keys(TOOL_COMPONENTS)) {
      expect(catalogIds.has(id), `catalog missing ${id}`).toBe(true);
    }
  });

  it("component and message aggregators cover the same ids", () => {
    const componentIds = toolModules.map((t) => t.id).sort();
    const messageIds = toolMessages
      .flatMap((m) => Object.keys((m.en.Tools ?? {}) as Record<string, unknown>))
      .sort();
    expect(messageIds).toEqual(componentIds);
  });

  it("tool ToolUI keys never collide with central or each other", () => {
    const central: Record<string, Record<string, unknown>> = { en, "zh-TW": zhTW };
    for (const locale of routing.locales) {
      const seen = new Map<string, string>();
      for (const k of Object.keys((central[locale]?.ToolUI ?? {}) as Record<string, unknown>)) {
        seen.set(k, "central");
      }
      for (const m of toolMessages) {
        const ui = (m[locale].ToolUI ?? {}) as Record<string, unknown>;
        for (const k of Object.keys(ui)) {
          expect(seen.has(k), `${locale} ToolUI.${k} collides with ${seen.get(k)}`).toBe(false);
          seen.set(k, "fragment");
        }
      }
    }
  });
});
