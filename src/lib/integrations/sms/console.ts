import type { SmsProvider } from "./types";

// 개발용: 문자를 보내지 않고 서버 로그에만 남긴다 (Vercel → Logs에서 확인)
export const consoleProvider: SmsProvider = {
  id: "console",
  async send(to, text) {
    console.info(`[sms:console] to=${to} text=${text}`);
  },
};
