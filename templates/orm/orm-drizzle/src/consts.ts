// drizzle-kit `generate` 產出的 migration 會把 enum 型別與 FK 目標硬綁到
// `public.`。若 migrate 的預設 schema 不是 `public`（例如用 search_path 切到
// 別的 schema），enum 型別會解析不到、FK 找不到關聯，migration 直接炸掉；
// 加上每個 schema 各自的 `__drizzle_migrations` 追蹤表，切 schema 還會導致
// 從 0000 重播。所以預設維持 `public`，與 drizzle-kit 的輸出保持一致。
// 若要用非 public 的 schema，請改用 drizzle `pgSchema()` 定義 table，讓
// generate 的輸出也綁到同一個 schema，端到端保持一致。
export const SCHEMA = 'public';
export const DATABASE = 'orm';
