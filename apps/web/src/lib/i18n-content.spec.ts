import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { packageSlug } from "./i18n-content";
import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

type Catalog = {
  Tools?: Record<string, { title?: string; description?: string } | undefined>;
  Packages?: Record<string, { description?: string } | undefined>;
};

describe("registry content keys exist in every catalog", () => {
  const catalogs: Record<string, Catalog> = { en, "zh-TW": zhTW };

  it("every tool id has title + description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const tool of toolRegistry) {
        expect(msg.Tools?.[tool.id]?.title, `${loc} Tools.${tool.id}.title`).toBeTruthy();
        expect(msg.Tools?.[tool.id]?.description, `${loc} Tools.${tool.id}.description`).toBeTruthy();
      }
    }
  });

  it("every package slug has a description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const pkg of packageRegistry) {
        const slug = packageSlug(pkg.name);
        expect(msg.Packages?.[slug]?.description, `${loc} Packages.${slug}.description`).toBeTruthy();
      }
    }
  });
});
