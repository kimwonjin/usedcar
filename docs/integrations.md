# 외부 연동 가이드

외부 업체가 필요한 기능(문자 인증, 결제, 현지 서버)은 **구조와 개발용 가짜 구현까지 완성**되어 있다.
출시 때는 업체와 계약한 뒤 아래 표의 값만 넣거나 한 파일만 구현하면 된다. 코드 위치는 `src/lib/integrations/`.

| 연동 | 지금(개발) | 출시 때 할 일 |
| --- | --- | --- |
| 로그인 | 번호만 입력(인증번호 없음) | 문자 업체 연결 + `NEXT_PUBLIC_AUTH_MODE=phone` |
| 인증 문자 발송 | Supabase 기본 | 현지 업체 사용 시 Send SMS Hook → `/api/auth/sms-hook` |
| 결제 | 가짜 결제(`payments_mode = mock`) | 업체 구현 1개 + 환경변수 + `payments_mode = live` |
| DB·파일 서버 | Supabase 클라우드(해외) | 카자흐스탄 서버에 Supabase 설치 후 주소 교체 (`docs/kz-data-localization.md`) |
| 푸시 알림 | 동작 중 (웹 푸시, 업체 계약 불필요) | — |

## 1. 문자 인증 로그인

1. 문자 업체 선택
   - **Supabase 기본 지원**(Twilio, Vonage, MessageBird): Supabase → Authentication → Sign In / Providers → Phone 에서 키 입력. 코드 변경 없음.
   - **현지 업체**(예: Mobizon.kz): Supabase → Authentication → Hooks → **Send SMS** 를 켜고 주소에
     `https://<도메인>/api/auth/sms-hook` 입력 → 발급된 비밀값(`v1,whsec_...`)을 Vercel `SEND_SMS_HOOK_SECRET` 에,
     `SMS_PROVIDER=mobizon`, `MOBIZON_API_KEY=<키>` 를 넣는다. 다른 업체는 `src/lib/integrations/sms/` 에 `SmsProvider` 하나를 추가.
2. Supabase → Authentication → Phone 을 켠다.
3. Vercel 환경변수 `NEXT_PUBLIC_AUTH_MODE=phone` → 재배포. 로그인 화면이 6자리 인증번호 방식으로 바뀐다.
4. 개발용 이메일 계정(`*@phone.satu.dev`)은 새 DB로 옮기지 않는다.

`/api/auth/sms-hook` 은 Standard Webhooks 서명을 검증하고, 사용자 언어(ko/ru/kk, 기본 ru)로 문자를 만든다.
비밀값이 없으면 501 을 돌려주므로 실수로 열려 있지 않다. `SMS_PROVIDER=console` 이면 문자를 보내지 않고 서버 로그에만 남긴다.

## 2. 결제 (딜러 수수료, 이후 예약비·보증금)

흐름: 거래 완료 → DB가 수수료 청구서(`payments`, `purpose = dealer_fee`) 생성 → 딜러 **정산** 화면에서 결제하기
→ `/api/payments/checkout` 이 업체 결제창 주소를 받아 이동 → 업체가 `/api/payments/webhook/<업체>` 로 결과 통보
→ 서버가 `mark_payment_paid` 로 DB 반영.

- 결제 목적은 `dealer_fee`, `deposit`(보증금), `reservation`(예약비)이 준비되어 있다. 새 목적은 DB check 와 화면 문구만 추가.
- 수수료 금액은 관리자 **설정** 화면의 구간표(`fee_bands`)로 계산된다.
- 납부 기한(`fee_due_days`, 기본 7일)이 지난 미납이 있으면 입찰이 막힌다(`block_bidding_on_overdue`, 설정에서 끌 수 있음).

출시 전환:
1. 업체 계약(후보: Kaspi Pay, Freedom Pay(Paybox), CloudPayments KZ, Halyk ePay) → 상점 ID·키·웹훅 서명 방식을 받는다.
2. `src/lib/integrations/payments/template.ts` 를 참고해 업체 파일을 만들고 `payments/index.ts` 에 등록.
3. 비밀값 하나를 만들어 두 곳에 같은 값으로 넣는다.
   - Vercel: `PAYMENTS_PROVIDER=<업체>`, `PAYMENTS_WEBHOOK_SECRET=<비밀값>`
   - Supabase SQL: `insert into app_config values ('payments_webhook_secret', '<비밀값>');`
4. 업체 관리 화면에 웹훅 주소 `https://<도메인>/api/payments/webhook/<업체>` 등록.
5. 관리자 설정 화면에서 결제 모드를 **live** 로 바꾼다(가짜 결제 차단).

## 3. 환경변수 목록

| 이름 | 용도 | 지금 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DB 접속 (없으면 코드 기본값) | 설정됨 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_DISPATCH_SECRET` | 웹 푸시 | 설정됨 |
| `NEXT_PUBLIC_AUTH_MODE` | `phone` 이면 문자 인증 로그인 | 비어 있음 |
| `SMS_PROVIDER`, `MOBIZON_API_KEY`, `SEND_SMS_HOOK_SECRET` | 현지 문자 업체 | 비어 있음 |
| `PAYMENTS_PROVIDER`, `PAYMENTS_WEBHOOK_SECRET` | 결제 업체 | 비어 있음(mock) |
| `NEXT_PUBLIC_SITE_URL` | 서비스 주소 | 기본값 usedcar-rouge.vercel.app |
