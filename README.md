# Satu — 알마티 중고차 셀프 경매

알마티 개인 차주가 차량 사진과 정보를 올리면, 승인된 현지 딜러들이 48시간 동안 입찰하는 "내 차 팔기" 경매 서비스(카자흐스탄판 헤이딜러).

## 기술 스택과 선택 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 프레임워크 | **Next.js 16 (App Router) + TypeScript** | Vercel이 만든 프레임워크라 배포 설정이 거의 없다. 판매자·딜러 앱과 관리자 웹을 코드베이스 하나로 운영 |
| 앱 형태 | **모바일 웹(PWA) 먼저** | 앱스토어 심사 없이 바로 출시·수정. 판매자는 몇 년에 한 번 쓰는 사람이라 설치 장벽이 없어야 함. 딜러 앱스토어 앱은 2단계에 Capacitor로 같은 코드를 감싸서 출시 |
| DB·인증·파일 | **Supabase** (Postgres, Auth, Storage, Realtime, pg_cron) | 휴대폰 OTP 로그인, 차량 사진 저장, 실시간 최고가 갱신, 48시간 마감 처리를 별도 서버 없이 해결 |
| 권한 | **Postgres RLS + RPC 함수** | 입찰·낙찰처럼 돈이 걸린 규칙을 DB 안에서 강제. 앱 코드에 버그가 있어도 딜러가 남의 입찰가를 보거나 마감 후 입찰할 수 없음 |
| 스타일 | **Tailwind CSS v4** | 컨셉 리포트의 컬러·글자 크기를 디자인 토큰으로 정의 (`src/app/globals.css`) |
| 다국어 | **next-intl** (ko → ru, kk) | URL별 언어(`/ko`, `/ru`, `/kk`), 문구는 `messages/*.json`에서만 관리 |
| 글꼴 | Pretendard(한국어), Inter(키릴·숫자) | 리포트 지정. 가격은 고정폭 숫자(`.price`) |

## 폴더 구조

```
messages/              ko.json · ru.json · kk.json (모든 화면 문구)
src/
  app/[locale]/        page(S1 랜딩) · login · sell(판매자) · dealer(딜러) · admin(관리자)
  components/          Header, Countdown, Badge …
  i18n/                언어 라우팅 설정
  lib/supabase/        브라우저·서버·proxy용 Supabase 클라이언트
  lib/format.ts        4 500 000 ₸ 형식 가격 표기
  proxy.ts             언어 리다이렉트 + 세션 갱신 (Next 16에서 middleware → proxy로 이름 변경)
supabase/
  migrations/          DB 스키마·RLS·경매 함수
  config.toml          로컬 Supabase 설정
```

## DB 설계 요약

| 테이블 | 내용 |
| --- | --- |
| `profiles` | 사용자(역할: seller / dealer / admin). 가입 시 자동 생성 |
| `dealers` | 딜러 신청서(사업자번호 БИН, 매장 사진), 승인 상태·평점 |
| `cars`, `car_photos` | 차량 정보(우핸들·통관 여부 포함), 촬영 가이드 8칸 사진 |
| `auctions` | 48시간 경매. live → ended → accepted / rejected / no_bids |
| `bids` | 딜러당 1건, 진행 중 올리기만 가능 |
| `deals` | 낙찰 후 거래(만남 일정·장소) |
| `depreciation_claims` | 감가 청구 → 관리자 심사 |

| 함수 (RPC) | 누가 | 하는 일 |
| --- | --- | --- |
| `start_auction` | 판매자 | 필수 사진 7칸 확인 후 48시간 경매 시작 |
| `place_bid` | 승인 딜러 | 입찰·입찰가 올리기, 내 순위 반환 |
| `my_bid_rank` / `auction_stats` | 딜러 / 모두 | 내 순위, 입찰 수 (최고가는 판매자·관리자만) |
| `auction_top_bids` | 판매자 | 상위 3위 딜러 이름·평점·금액 |
| `accept_bid` / `reject_auction` | 판매자 | 판매 결정(거래 생성) / 거절 |
| `review_dealer` | 관리자 | 딜러 승인·거절·정지 |
| `close_expired_auctions` | pg_cron (1분마다) | 마감 시간이 지난 경매 종료 |
| `cancel_my_auction` | 판매자 | 입찰 전 경매 취소 |
| `complete_deal` / `cancel_deal` | 판매자 | 거래 완료(최종가 = 낙찰가 − 승인된 감가) / 취소 |
| `comment_claim` | 판매자 | 감가 청구에 의견 |
| `review_claim` | 관리자 | 감가 승인·거절 |
| `rate_dealer` | 판매자 | 완료 거래 딜러 평가 → 딜러 평점 평균 |
| `admin_cancel_auction` | 관리자 | 경매 강제 종료 |
| `process_decision_deadlines` | pg_cron (1분마다) | 경매 종료 후 12시간째 판매자 알림, 24시간 안에 결정하지 않으면 '기한 초과'로 종료 |

연락처는 낙찰된 딜러와 판매자 사이에서만 공개된다(RLS).

## 시작하기

### 1. Supabase 프로젝트 만들기
1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (리전: 가까운 `Frankfurt (eu-central-1)` 권장)
2. Database → Extensions에서 **pg_cron** 켜기
3. 마이그레이션 적용 (둘 중 하나)
   - SQL Editor에 `supabase/migrations/` 폴더의 파일을 **이름 순서대로** 하나씩 붙여넣고 실행
   - 또는 CLI: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npm run db:push`
4. Authentication → Sign In / Providers → **Phone** 켜고 SMS 제공자 연결
   - Supabase 기본 지원: Twilio, Vonage, MessageBird (카자흐스탄 +7 발송 가능)
   - 현지 업체(Mobizon.kz 등)를 쓰려면 Auth의 Send SMS Hook으로 연결
5. 관리자 지정: 로그인한 뒤 SQL Editor에서
   `update profiles set role = 'admin' where phone = '+7701xxxxxxx';`

### 2. 로컬 실행
```bash
cp .env.example .env.local   # Supabase URL·anon key 입력
npm install
npm run dev                  # http://localhost:3000 → /ko 로 이동
```

Docker가 있는 환경이면 `npm run db:start`로 로컬 Supabase를 띄울 수 있다. 로컬에서는 `+7 701 000 00 01`~`03` 번호가 인증번호 `123456`으로 로그인된다(`supabase/config.toml`).

### 3. Vercel 배포
1. Vercel → Add New Project → GitHub `usedcar` 저장소 선택 (프레임워크 자동 인식)
2. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입력
   - 푸시 알림: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_DISPATCH_SECRET` (키 생성: `npx web-push generate-vapid-keys`)
   - Supabase SQL: `insert into app_config values ('push_dispatch_url', 'https://<도메인>/api/push'), ('push_dispatch_secret', '<PUSH_DISPATCH_SECRET과 같은 값>');`
3. Deploy. 이후 브랜치에 push할 때마다 미리보기 URL이 생성된다
4. Supabase → Authentication → URL Configuration의 Site URL에 Vercel 도메인 입력

## 스크립트

| 명령 | 내용 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` / `npm run typecheck` | 코드 검사 |
| `npm run db:push` | 연결된 Supabase에 마이그레이션 적용 |
| `npm run db:types` | DB 타입 생성(로컬 Supabase 필요) |

## 진행 상황 (MVP 18개 화면)

- [x] 프로젝트 구조, 디자인 토큰, 3개 언어 라우팅 (ko·ru·kk)
- [x] DB 스키마·RLS·경매/거래/감가 함수 (로컬 Postgres로 전체 흐름 검증)
- [x] S1 랜딩, 로그인 (개발 중에는 인증번호 없이 전화번호만, 출시 때 `NEXT_PUBLIC_AUTH_MODE=phone`으로 휴대폰 OTP 전환)
- [x] S2 판매자 홈, S3~S5 차량 등록 + 사진 촬영 가이드
- [x] S6 경매 진행(Realtime 최고가), S7 결과(상위 3위 선택·거절·재등록), S8 거래(일정·감가 확인·완료·딜러 평가)
- [x] D1 딜러 가입·재신청, D2 경매 목록(사진·필터·정렬), D3 차량 상세, D4 블라인드 입찰, D5 낙찰·감가 청구, D6 내 활동·수수료·평판
- [x] A1 대시보드, A2 딜러 승인·거절·경고·정지, A3 경매 관리·강제 종료, A4 감가 심사(사진 비교)
- [ ] 촬영 가이드 예시 그림을 실제 예시 사진으로 교체
- [x] 알림: 앱 안 알림함(🔔) + 웹 푸시 20종 (새 매물, 1위 뺏김, 마감 1시간 전, 낙찰, 경매 종료, 감가, 딜러 심사 등)
- [ ] 수수료 정책 확정 (`src/lib/fees.ts` 임시 구간표)
- [ ] 휴대폰 OTP 로그인 켜기: SMS 업체 연결 + Vercel에 `NEXT_PUBLIC_AUTH_MODE=phone` (최종 단계)
- [ ] 러시아어·카자흐어 번역 원어민 검수 (현재는 초안)
