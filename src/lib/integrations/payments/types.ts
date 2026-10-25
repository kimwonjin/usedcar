// 결제 업체 연동 규격. 새 업체는 이 인터페이스만 구현하면 화면·DB 코드는 그대로 쓴다.
export type CheckoutRequest = {
  paymentId: string;
  amount: number; // 텡게 정수
  currency: "KZT";
  description: string;
  locale: string;
  returnUrl: string; // 결제 후 돌아올 주소
};

export type WebhookResult = {
  paymentId: string;
  providerRef: string;
  status: "paid" | "failed";
};

export interface PaymentProvider {
  id: string;
  // 결제창 주소를 만든다 (업체 결제 페이지 또는 개발용 가짜 결제 페이지)
  createCheckout(request: CheckoutRequest): Promise<{ redirectUrl: string }>;
  // 업체 웹훅 요청을 검증하고 결과를 돌려준다. 우리와 무관한 요청이면 null
  parseWebhook(request: Request): Promise<WebhookResult | null>;
}
