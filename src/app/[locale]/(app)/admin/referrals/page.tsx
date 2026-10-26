import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MarkPaidButton } from "./mark-paid-button";

type RewardRow = {
  id: string;
  role: "referrer" | "referee";
  amount: number;
  status: "pending" | "paid" | "void";
  created_at: string;
  paid_at: string | null;
  user: { phone: string | null; full_name: string | null } | null;
  referee: { phone: string | null; full_name: string | null } | null;
};

// 추천 보상: 추천받은 판매자의 첫 거래가 끝나면 쌓인다. 지급(결제 연동 전에는 수동) 후 '지급 완료'로 바꾼다
export default async function AdminReferrals({ params }: PageProps<"/[locale]/admin/referrals">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("adminReferrals");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const supabase = await createClient();
  const [{ data }, { count: referredCount }] = await Promise.all([
    supabase
      .from("referral_rewards")
      .select(
        "id, role, amount, status, created_at, paid_at, user:profiles!referral_rewards_user_id_fkey(phone, full_name), referee:profiles!referral_rewards_referee_id_fkey(phone, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .overrideTypes<RewardRow[], { merge: false }>(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("referred_by", "is", null),
  ]);
  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-caption text-ink/60">{t("referred")}</p>
          <p className="price text-title font-bold">{referredCount ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-caption text-ink/60">{t("pendingTotal")}</p>
          <p className="price text-title font-bold">{formatTenge(pending)}</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-caption">
          <thead className="border-b border-ink/10 text-ink/60">
            <tr>
              <th className="p-3">{t("created")}</th>
              <th className="p-3">{t("recipient")}</th>
              <th className="p-3">{t("role")}</th>
              <th className="p-3">{t("referee")}</th>
              <th className="p-3 text-right">{t("amount")}</th>
              <th className="p-3">{t("status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3">{formatDateTime(r.created_at, locale)}</td>
                <td className="p-3">
                  {r.user?.full_name ?? "—"} <span className="price text-ink/60">{r.user?.phone ?? ""}</span>
                </td>
                <td className="p-3">{t(`roles.${r.role}`)}</td>
                <td className="p-3">
                  {r.referee?.full_name ?? "—"} <span className="price text-ink/60">{r.referee?.phone ?? ""}</span>
                </td>
                <td className="price p-3 text-right font-semibold">{formatTenge(r.amount)}</td>
                <td className="p-3">
                  {r.status === "pending" ? (
                    <MarkPaidButton rewardId={r.id} />
                  ) : (
                    <span className="text-ink/60">
                      {t(`statuses.${r.status}`)}
                      {r.paid_at && ` · ${formatDateTime(r.paid_at, locale)}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-ink/60">{t("empty")}</p>}
      </div>
    </div>
  );
}
