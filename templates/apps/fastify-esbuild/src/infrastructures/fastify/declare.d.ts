import 'fastify'; // 讓 TS 先載入原本 fastify 的宣告

// 擴展 FastifyRequest 類型以包含自定義屬性
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

export {}; // 把這個檔案變成「模組」，避免覆蓋整個 fastify module
