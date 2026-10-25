import { getPaymentProvider } from "@/lib/integrations/payments";
import { createClient } from "@/lib/supabase/server";

// 결제 시작: 로그인한 사용자의 미결제 청구서만. 결제창 주소를 돌려준다
export async function POST(request: Request) {
  const { paymentId, locale } = (await request.json()) as { paymentId?: string; locale?: string };
  if (!paymentId) return Response.json({ error: "paymentId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, currency, description, status")
    .eq("id", paymentId)
    .maybeSingle();
  // RLS로 본인 청구서만 읽힌다
  if (!payment) return Response.json({ error: "not found" }, { status: 404 });
  if (payment.status !== "pending" && payment.status !== "failed") {
    return Response.json({ error: "not payable" }, { status: 409 });
  }

  const provider = getPaymentProvider();
  if (!provider) return Response.json({ error: "payments not configured" }, { status: 503 });
  const lang = locale ?? "ko";
  try {
    const { redirectUrl } = await provider.createCheckout({
      paymentId: payment.id as string,
      amount: payment.amount as number,
      currency: "KZT",
      description: (payment.description as string | null) ?? "Satu",
      locale: lang,
      returnUrl: `/${lang}/dealer/billing`,
    });
    return Response.json({ redirectUrl });
  } catch {
    return Response.json({ error: "provider unavailable" }, { status: 503 });
  }
}
