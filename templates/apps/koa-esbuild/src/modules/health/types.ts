export enum EnumHealthStatus {
  OK = 'ok', // 系統健康
  WARN = 'warn', // 有警告（如資源緊繃、延遲）
  ERROR = 'error', // 系統有嚴重錯誤
  UNAVAILABLE = 'unavailable', // 無法取得健康狀態
}
export type HealthInfo = {
  app: string;
  version: string;
  environment: string;
  status: EnumHealthStatus;
  timezone: string;
  timestamp: Date;
};
