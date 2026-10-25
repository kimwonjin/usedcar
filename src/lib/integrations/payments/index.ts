import "server-only";
import { paymentsProvider } from "../config";
import { mockProvider } from "./mock";
import { createTemplateProvider } from "./template";
import type { PaymentProvider } from "./types";

// 업체 이름 → 구현. 실제 업체를 붙이면 template 대신 그 구현으로 바꾼다
const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  kaspi: createTemplateProvider("kaspi"),
  freedompay: createTemplateProvider("freedompay"),
  cloudpayments: createTemplateProvider("cloudpayments"),
};

export function getPaymentProvider(id: string = paymentsProvider): PaymentProvider | null {
  return providers[id] ?? null;
}
