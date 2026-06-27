"use client";

import type { FormConfig } from "@rfjs/form-builder";
import { ConfigFormBuilder } from "@rfjs/form-builder-ui";

// A v2 sections config that showcases the item-kind model: named sections,
// content / field / ai-note / divider kinds, plus validation, a conditional,
// and a per-field AI note.
const SAMPLE_CONFIG: FormConfig = {
  version: 1,
  sections: [
    {
      id: "sec_account",
      title: { en: "Account", "zh-TW": "帳號" },
      rows: [
        {
          id: "r_welcome",
          items: [
            {
              id: "i_welcome",
              kind: "content",
              text: { en: "Fill in your account details below.", "zh-TW": "請填寫以下帳號資訊。" },
              locked: true,
            },
          ],
        },
        {
          id: "r_name",
          items: [
            { id: "i_name", kind: "field", key: "name", label: { en: "Name", "zh-TW": "姓名" }, component: "Input", dataType: "string", required: true },
          ],
        },
        {
          id: "r_email",
          items: [
            {
              id: "i_email",
              kind: "field",
              key: "email",
              label: { en: "Email", "zh-TW": "電子郵件" },
              component: "Input",
              dataType: "string",
              required: true,
              validation: { pattern: "^[^@\\s]+@[^@\\s]+$", message: "Enter a valid email" },
            },
          ],
        },
        {
          id: "r_role",
          items: [
            {
              id: "i_role",
              kind: "field",
              key: "role",
              label: { en: "Role", "zh-TW": "角色" },
              component: "Select",
              dataType: "string",
              options: [
                { label: "Admin", value: "admin" },
                { label: "User", value: "user" },
              ],
              aiNote: "Pick 'admin' only for internal staff.",
            },
          ],
        },
        {
          id: "r_guide",
          items: [
            { id: "i_guide", kind: "ai-note", text: "If the user is unsure of their role, default to 'user'." },
          ],
        },
        {
          id: "r_manager",
          items: [
            {
              id: "i_manager",
              kind: "field",
              key: "manager",
              label: { en: "Manager", "zh-TW": "主管" },
              component: "Input",
              dataType: "string",
              conditional: { logic: "and", filters: [{ field: "role", dataType: "string", operator: "eq", value: "admin" }] },
            },
          ],
        },
      ],
    },
    {
      id: "sec_profile",
      title: { en: "Profile", "zh-TW": "個人資料" },
      rows: [
        {
          id: "r_bio",
          items: [
            { id: "i_bio", kind: "field", key: "bio", label: { en: "Bio", "zh-TW": "簡介" }, component: "Textarea", dataType: "string" },
          ],
        },
        { id: "r_div", items: [{ id: "i_div", kind: "divider" }] },
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
