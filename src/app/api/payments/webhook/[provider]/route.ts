import { createClient } from "@supabase/supabase-js";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { paymentsWebhookSecret } from "@/lib/integrations/config";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// 결제 업체 웹훅: 업체 서명 검증은 각 업체 구현(parseWebhook)이 하고, DB 반영은 공유 비밀값으로 한다
export async function POST(request: Request, { params }: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider: providerId } = await params;
  const provider = getPaymentProvider(providerId);
  if (!provider || provider.id === "mock" || !paymentsWebhookSecret) {
    return Response.json({ error: "not configured" }, { status: 404 });
  }

  let result;
  try {
    result = await provider.parseWebhook(request);
  } catch {
    return Response.json({ error: "invalid webhook" }, { status: 400 });
  }
  if (!result) return Response.json({ ok: true });
  if (result.status !== "paid") return Response.json({ ok: true, ignored: result.status });

  const { error } = await createClient(supabaseUrl, supabaseAnonKey).rpc("mark_payment_paid", {
    p_secret: paymentsWebhookSecret,
    p_payment_id: result.paymentId,
    p_provider: provider.id,
    p_provider_ref: result.providerRef,
  });
  // 이미 처리된 결제의 중복 통보도 업체에는 성공으로 답한다
  return Response.json({ ok: !error || error.message.includes("not payable") });
}
