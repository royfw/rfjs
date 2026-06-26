"use client";

import type { FormConfig } from "@rfjs/form-builder";
import { ConfigFormBuilder } from "@rfjs/form-builder-ui";

const SAMPLE_CONFIG: FormConfig = {
  version: 1,
  fields: [
    { key: "name", label: "Name", component: "Input", dataType: "string", required: true },
    { key: "email", label: "Email", component: "Input", dataType: "string" },
    {
      key: "role",
      label: "Role",
      component: "Select",
      dataType: "string",
      options: [
        { label: "Admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    },
  ],
};

export function FormBuilderTool() {
  return (
    <div className="flex flex-col gap-5">
      <ConfigFormBuilder initialConfig={SAMPLE_CONFIG} locales={["en", "zh-TW"]} />
    </div>
  );
}
