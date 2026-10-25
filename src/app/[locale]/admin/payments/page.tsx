import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Badge } from "@/components/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { isOverdue, type Payment } from "@/lib/payments";
import { formatPhoneInput } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { PaymentActions } from "./payment-actions";

const FILTERS = ["pending", "paid", "all"] as const;

// 결제·청구 관리: 미납·연체 확인, 현장·계좌 입금 등 수동 처리
export default async function AdminPayments({ params, searchParams }: PageProps<"/[locale]/admin/payments">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("billing");
  const ta = await getTranslations("admin");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const filter = FILTERS.find((f) => f === query.status) ?? "pending";

  const supabase = await createClient();
  let request = supabase
    .from("payments")
    .select("id, purpose, amount, status, description, deal_id, due_at, paid_at, provider, created_at, profiles(phone, dealers!dealers_id_fkey(business_name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") request = request.eq("status", filter);
  const { data } = await request.overrideTypes<
    (Payment & { profiles: { phone: string | null; dealers: { business_name: string } | null } | null })[],
    { merge: false }
  >();
  const payments = data ?? [];
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{ta("paymentsTitle")}</h1>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/payments?status=${f}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              f === filter ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {f === "all" ? ta("all") : t(`status.${f}`)}
          </Link>
        ))}
        <span className="price ml-auto text-caption text-ink/60">
          {ta("total")} {formatTenge(total)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-caption">
          <thead className="border-b border-ink/10 text-ink/60">
            <tr>
              <th className="p-3">{ta("payer")}</th>
              <th className="p-3">{ta("item")}</th>
              <th className="p-3 text-right">{ta("amount")}</th>
              <th className="p-3">{ta("due")}</th>
              <th className="p-3">{ta("status")}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <p className="font-semibold">{p.profiles?.dealers?.business_name ?? "—"}</p>
                  <p className="price text-ink/50">{p.profiles?.phone ? formatPhoneInput(p.profiles.phone) : ""}</p>
                </td>
                <td className="p-3">
                  <p>{t(`purpose.${p.purpose}`)}</p>
                  <p className="text-ink/50">{p.description}</p>
                </td>
                <td className="price p-3 text-right font-semibold">{formatTenge(p.amount)}</td>
                <td className="p-3">{p.paid_at ? formatDateTime(p.paid_at, locale) : p.due_at ? formatDate(p.due_at, locale) : "—"}</td>
                <td className="p-3">
                  <Badge tone={p.status === "paid" ? "verified" : isOverdue(p) ? "warning" : "neutral"}>
                    {isOverdue(p) ? t("overdue") : t(`status.${p.status}`)}
                  </Badge>
                  {p.provider && <p className="mt-1 text-ink/40">{p.provider}</p>}
                </td>
                <td className="p-3">{(p.status === "pending" || p.status === "failed") && <PaymentActions paymentId={p.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <p className="p-8 text-center text-ink/60">{ta("emptyList")}</p>}
      </div>
    </div>
  );
}
