"use client";

import { ConfigFormBuilder } from "@rfjs/form-builder-ui";

export function FormBuilderTool() {
  return (
    <div className="flex flex-col gap-5">
      <ConfigFormBuilder locales={["en", "zh-TW"]} />
    </div>
  );
}
