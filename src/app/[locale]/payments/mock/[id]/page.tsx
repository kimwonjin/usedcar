import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MockPayActions } from "./mock-pay-actions";

// 개발용 가짜 결제창: 실제 결제 업체 결제창 자리. payments_mode = mock 일 때만 결제가 처리된다
export default async function MockCheckout({ params }: PageProps<"/[locale]/payments/mock/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("billing");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  const supabase = await createClient();
  const { data: payment } = await supabase.from("payments").select("id, amount, description, status").eq("id", id).maybeSingle();
  if (!payment) notFound();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border-2 border-dashed border-gold bg-white p-6 text-center shadow-sm">
        <p className="text-caption font-semibold text-ink/50">{t("mockTitle")}</p>
        <p className="mt-3 text-body">{payment.description as string}</p>
        <p className="price mt-1 text-price font-bold text-navy">{formatTenge(payment.amount as number)}</p>
        <p className="mt-3 text-caption text-ink/60">{t("mockHint")}</p>
        <MockPayActions paymentId={id} payable={payment.status === "pending" || payment.status === "failed"} />
      </div>
    </div>
  );
}
