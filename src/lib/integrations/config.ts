import "server-only";

// 외부 연동 설정을 한곳에 모은다. 출시 때는 아래 환경변수만 바꾸면 된다 (docs/integrations.md 참고).

// 결제 업체: mock(개발용 가짜 결제) | 실제 업체 이름. 업체를 추가하면 payments/index.ts에 등록한다
export const paymentsProvider = process.env.PAYMENTS_PROVIDER ?? "mock";
// 결제 업체 웹훅 → DB 결제 완료 처리에 쓰는 비밀값 (Supabase app_config.payments_webhook_secret 과 같은 값)
export const paymentsWebhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET ?? "";

// 문자 발송 업체: console(개발용, 서버 로그에만 출력) | mobizon
export const smsProvider = process.env.SMS_PROVIDER ?? "console";
// Supabase Auth "Send SMS Hook" 서명 비밀값 (v1,whsec_... 형식 그대로)
export const smsHookSecret = process.env.SEND_SMS_HOOK_SECRET ?? "";

// 서비스 주소 (결제 후 돌아올 주소 등)
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcar-rouge.vercel.app").replace(/\/$/, "");
