import type { FormConfig, DataSourceFetcher, UploadHandler } from "@rfjs/form-builder";

// Shared demo data for the form-builder tool (seeded into the 2D canvas via formConfigToCards).

// Mock uploader — returns a FileRef from the File object (uses createObjectURL when available).
// Module-level const is a stable reference (no re-upload loops).
export const sampleUploader: UploadHandler = async (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  url: typeof URL !== "undefined" ? URL.createObjectURL(file) : undefined,
});

// Mock fetcher — no network. Returns canned data for known dataSource URLs.
// Module-level const is a stable reference (no re-fetch loops).
export const sampleFetcher: DataSourceFetcher = async (req) => {
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
// divider), validation, a conditional, a per-field AI note, dataSource — and the
// field types Email, Number, DatePicker, Radio, Switch.
export const SAMPLE_CONFIG: FormConfig = {
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
        {
          id: "r_actions",
          items: [
            { id: "btn_submit", kind: "button", label: { en: "Submit request", "zh-TW": "送出申請" }, action: { type: "submit" }, variant: "primary" },
            { id: "btn_draft", kind: "button", label: { en: "Save draft", "zh-TW": "存草稿" }, action: { type: "custom", name: "save-draft" } },
            { id: "btn_clear", kind: "button", label: { en: "Clear", "zh-TW": "清除" }, action: { type: "clear", fields: ["name", "email"] }, variant: "ghost" },
          ],
        },
        {
          id: "r_query",
          items: [
            { id: "btn_query", kind: "button", label: { en: "Query", "zh-TW": "查詢" }, action: { type: "api", url: "/api/search", fields: ["name", "email"] } },
          ],
        },
        {
          id: "r_result",
          items: [
            { id: "res_query", kind: "result", mode: "card", sourceId: "btn_query", dataPath: "received.data", emptyText: { en: "Run a query to see results", "zh-TW": "按查詢看結果" } },
          ],
        },
      ],
    },
  ],
};
