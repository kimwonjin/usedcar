import { createHmac, timingSafeEqual } from "node:crypto";
import { getSmsProvider } from "@/lib/integrations/sms";
import { smsHookSecret } from "@/lib/integrations/config";

// Supabase Auth "Send SMS Hook": 인증번호 문자를 우리가 고른 업체(현지 업체 포함)로 보낸다.
// Supabase 대시보드 → Authentication → Hooks → Send SMS 에 이 주소를 넣고, 발급된 비밀값을 SEND_SMS_HOOK_SECRET 에 넣는다.
// 요청 서명은 Standard Webhooks 규격(webhook-id·webhook-timestamp·webhook-signature 헤더)이다.
const TOLERANCE_SECONDS = 5 * 60;

function verify(body: string, headers: Headers): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures || !smsHookSecret) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(smsHookSecret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(" ").some((entry) => {
    const [, value] = entry.split(",");
    const given = Buffer.from(value ?? "", "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const templates: Record<string, (code: string) => string> = {
  ko: (code) => `[Garajym] 인증번호 ${code}`,
  ru: (code) => `[Garajym] Код подтверждения: ${code}`,
  kk: (code) => `[Garajym] Растау коды: ${code}`,
};

export async function POST(request: Request) {
  if (!smsHookSecret) return Response.json({ error: "sms hook not configured" }, { status: 501 });
  const body = await request.text();
  if (!verify(body, request.headers)) return Response.json({ error: "invalid signature" }, { status: 401 });

  const payload = JSON.parse(body) as { user?: { phone?: string; user_metadata?: { locale?: string } }; sms?: { otp?: string } };
  const phone = payload.user?.phone;
  const code = payload.sms?.otp;
  if (!phone || !code) return Response.json({ error: "bad payload" }, { status: 400 });

  const template = templates[payload.user?.user_metadata?.locale ?? "ru"] ?? templates.ru;
  try {
    await getSmsProvider().send(phone.startsWith("+") ? phone : `+${phone}`, template(code));
  } catch {
    return Response.json({ error: { http_code: 502, message: "sms provider failed" } }, { status: 502 });
  }
  return Response.json({});
}
