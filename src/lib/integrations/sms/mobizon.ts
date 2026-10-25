import type { SmsProvider } from "./types";

// Mobizon.kz (카자흐스탄 현지 문자 업체). 계약 후 MOBIZON_API_KEY 를 넣으면 동작한다.
// 아직 실제 키로 시험하지 않았다 — 연결할 때 업체 문서의 주소·응답 형식을 다시 확인한다.
export function createMobizonProvider(apiKey: string): SmsProvider {
  return {
    id: "mobizon",
    async send(to, text) {
      const params = new URLSearchParams({
        apiKey,
        recipient: to.replace(/\D/g, ""),
        text,
        output: "json",
      });
      const response = await fetch(`https://api.mobizon.kz/service/message/sendsmsmessage?${params}`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { code?: number; message?: string } | null;
      if (!response.ok || body?.code !== 0) {
        throw new Error(`mobizon send failed: ${body?.message ?? response.status}`);
      }
    },
  };
}
