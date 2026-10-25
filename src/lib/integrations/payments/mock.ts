import type { PaymentProvider } from "./types";

// 개발용 가짜 결제: 실제 돈이 오가지 않는다. 결제 페이지에서 '테스트 결제 완료'를 누르면 DB mock_pay로 처리된다.
// DB app_settings.payments_mode 가 'mock' 일 때만 동작한다 (운영 전환 시 'live' 로 바꾸면 막힌다).
export const mockProvider: PaymentProvider = {
  id: "mock",
  async createCheckout({ paymentId, locale }) {
    return { redirectUrl: `/${locale}/payments/mock/${paymentId}` };
  },
  async parseWebhook() {
    return null;
  },
};
