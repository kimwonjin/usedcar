import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { DealerTabs } from "@/components/dealer-tabs";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { isOverdue, type Payment } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { PayButton } from "./pay-button";

// 딜러 정산: 낙찰 수수료 청구서와 결제
export default async function DealerBilling({ params }: PageProps<"/[locale]/dealer/billing">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("billing");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });

  const supabase = await createClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, purpose, amount, status, description, deal_id, due_at, paid_at, provider, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<Payment[], { merge: false }>(),
    supabase.from("app_settings").select("key, value"),
  ]);
  const payments = data ?? [];
  const setting = new Map((settings ?? []).map((s) => [s.key as string, s.value as string]));
  const pending = payments.filter((p) => p.status === "pending" || p.status === "failed");
  const overdue = pending.filter(isOverdue);
  const pendingTotal = pending.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <DealerTabs />

      <section className="flex items-end justify-between rounded-xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-caption text-ink/60">{t("unpaidTotal")}</p>
          <p className="price text-title font-bold">{formatTenge(pendingTotal)}</p>
        </div>
        <p className="text-caption text-ink/60">{t("dueRule", { days: setting.get("fee_due_days") ?? "7" })}</p>
      </section>

      {overdue.length > 0 && setting.get("block_bidding_on_overdue") === "true" && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-body font-semibold text-danger">⛔ {t("overdueBlocked")}</p>
      )}
      {setting.get("fees_enabled") === "off" && (
        <p className="rounded-xl border border-steppe/30 bg-steppe/5 p-4 text-body font-semibold text-steppe">🎁 {t("freePilot")}</p>
      )}
      {setting.get("payments_mode") === "mock" && setting.get("fees_enabled") !== "off" && (
        <p className="rounded-lg bg-gold/15 px-3 py-2 text-caption text-ink/80">{t("mockNotice")}</p>
      )}

      {payments.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col gap-2">
        {payments.map((p) => {
          const late = isOverdue(p);
          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-caption text-ink/60">{t(`purpose.${p.purpose}`)}</p>
                  <p className="truncate text-body font-semibold">
                    {p.deal_id ? <Link href={`/dealer/deals/${p.deal_id}`}>{p.description}</Link> : p.description}
                  </p>
                </div>
                <Badge tone={p.status === "paid" ? "verified" : late ? "warning" : p.status === "pending" ? "review" : "neutral"}>
                  {late ? t("overdue") : t(`status.${p.status}`)}
                </Badge>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="price text-subtitle font-bold">{formatTenge(p.amount)}</p>
                  <p className="text-caption text-ink/50">
                    {p.paid_at
                      ? t("paidAt", { date: formatDateTime(p.paid_at, locale) })
                      : p.due_at && t("dueAt", { date: formatDate(p.due_at, locale) })}
                  </p>
                </div>
                {(p.status === "pending" || p.status === "failed") && <PayButton paymentId={p.id} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
