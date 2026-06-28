"use client";

import type { FormConfig, DataSourceFetcher } from "@rfjs/form-builder";
import { ConfigFormBuilder } from "@rfjs/form-builder-ui";

// ---------------------------------------------------------------------------
// Mock fetcher — no network. Returns canned data for known URLs.
// Module-level const is a stable reference (no re-fetch loops).
// ---------------------------------------------------------------------------
const mockFetcher: DataSourceFetcher = async (req) => {
  if (req.url === "/api/countries") {
    return {
      data: [
        { code: "tw", name: "Taiwan" },
        { code: "jp", name: "Japan" },
        { code: "us", name: "United States" },
      ],
    };
  }
  return { data: [] };
};

// A v2 sections config showcasing the item-kind model (content / field / ai-note /
// divider), validation, a conditional, a per-field AI note — and the v2-E field
// types: Email, Number, DatePicker, Radio, Switch.
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
            { id: "i_email", kind: "field", key: "email", label: { en: "Email", "zh-TW": "電子郵件" }, component: "Email", dataType: "string", required: true },
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
        {
          id: "r_age",
          items: [
            { id: "i_age", kind: "field", key: "age", label: { en: "Age", "zh-TW": "年齡" }, component: "Number", dataType: "numeric", validation: { min: 0, max: 120 } },
          ],
        },
        {
          id: "r_birthday",
          items: [
            { id: "i_birthday", kind: "field", key: "birthday", label: { en: "Birthday", "zh-TW": "生日" }, component: "DatePicker", dataType: "date", placeholder: "Pick a date" },
          ],
        },
        {
          id: "r_plan",
          items: [
            {
              id: "i_plan",
              kind: "field",
              key: "plan",
              label: { en: "Plan", "zh-TW": "方案" },
              component: "Radio",
              dataType: "string",
              options: [
                { label: "Free", value: "free" },
                { label: "Pro", value: "pro" },
              ],
            },
          ],
        },
        {
          id: "r_country",
          items: [
            {
              id: "i_country",
              kind: "field",
              key: "country",
              label: { en: "Country", "zh-TW": "國家" },
              component: "Select",
              dataType: "string",
              dataSource: {
                request: { url: "/api/countries" },
                extract: { dialect: "path", expr: "data" },
                optionLabel: "name",
                optionValue: "code",
                fallback: "無",
              },
            },
          ],
        },
        {
          id: "r_newsletter",
          items: [
            { id: "i_newsletter", kind: "field", key: "newsletter", label: { en: "Subscribe to newsletter", "zh-TW": "訂閱電子報" }, component: "Switch", dataType: "boolean" },
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
      <ConfigFormBuilder initialConfig={SAMPLE_CONFIG} locales={["en", "zh-TW"]} fetcher={mockFetcher} />
    </div>
  );
}
