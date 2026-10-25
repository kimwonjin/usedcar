import type { PaymentProvider } from "./types";

// 실제 결제 업체 연결용 틀. 카자흐스탄에서 많이 쓰는 후보: Kaspi Pay, Freedom Pay(Paybox), CloudPayments KZ, Halyk ePay.
// 업체와 계약하면 받는 것: 상점 ID, API 키(또는 서명 키), 결제창 생성 API 문서, 웹훅(결과 통보) 서명 방식.
// 구현 순서:
//   1) createCheckout: 업체 API로 결제 건을 만들고(금액·주문번호=paymentId·returnUrl) 결제창 주소를 돌려준다
//   2) parseWebhook: 업체 서명을 검증한 뒤 주문번호·업체 거래번호·성공 여부를 돌려준다
//   3) payments/index.ts 에 등록하고 PAYMENTS_PROVIDER 환경변수를 업체 이름으로 바꾼다
export function createTemplateProvider(id: string): PaymentProvider {
  return {
    id,
    async createCheckout() {
      throw new Error(`${id} payments are not configured yet`);
    },
    async parseWebhook() {
      throw new Error(`${id} webhook is not configured yet`);
    },
  };
}
