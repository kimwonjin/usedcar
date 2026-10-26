import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { requireAdmin } from "@/lib/auth";
import { loadFeeBands } from "@/lib/fees";
import { createClient } from "@/lib/supabase/server";
import { FeeBandsEditor, SettingsForm } from "./settings-forms";

// 운영 설정: 수수료 구간표, 결제 모드, 납부 기한, 미납 시 입찰 제한
export default async function AdminSettings({ params }: PageProps<"/[locale]/admin/settings">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("adminSettings");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const supabase = await createClient();
  const [bands, { data: settings }] = await Promise.all([loadFeeBands(supabase), supabase.from("app_settings").select("key, value")]);
  const values = Object.fromEntries((settings ?? []).map((s) => [s.key as string, s.value as string]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{t("feeBands")}</h2>
        <p className="text-caption text-ink/60">{t("feeBandsHint")}</p>
        <FeeBandsEditor initial={bands} />
      </section>
      <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{t("payments")}</h2>
        <SettingsForm
          initial={{
            payments_mode: values.payments_mode ?? "mock",
            fee_due_days: values.fee_due_days ?? "7",
            block_bidding_on_overdue: values.block_bidding_on_overdue ?? "true",
          }}
        />
      </section>
    </div>
  );
}
