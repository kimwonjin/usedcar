import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PushToggle } from "@/components/push-toggle";
import { ReferralCard, type ReferralStats } from "@/components/referral";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser, getDealer, getUserId } from "@/lib/auth";
import { formatPhoneInput } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { AlertPrefs, DeleteAccount, LogoutButton, NameForm, PriceWatches, PushPrefs } from "./account-forms";

const localeNames = { ko: "한국어", ru: "Русский", kk: "Қазақша" } as const;

// 내 정보: 이름, 전화번호(변경 불가), 언어, 푸시 알림, 딜러 상태, 로그아웃
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login", locale });
  const supabase = await createClient();
  const [user, { data: profile }, dealer, { data: watches }, { data: referral }, { data: rewardSetting }] = await Promise.all([
    getCurrentUser(),
    supabase.from("profiles").select("full_name, notify_new_auction, notify_makes, notify_year_from, notify_year_to, notify_max_km, notify_no_accident, push_muted, push_quiet_night").eq("id", userId).maybeSingle(),
    getDealer(userId),
    supabase.from("price_watches").select("id, make, model, year").order("created_at"),
    supabase.rpc("my_referral_stats"),
    supabase.from("app_settings").select("value").eq("key", "referral_reward").maybeSingle(),
  ]);
  const referralStats = ((referral ?? []) as ReferralStats[])[0];
  if (!user) return redirect({ href: "/login", locale });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>

      <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
        <NameForm initialName={(profile?.full_name as string | null) ?? ""} />
        <div>
          <p className="text-caption text-ink/60">{t("phone")}</p>
          <p className="price text-subtitle font-semibold">{user.phone ? formatPhoneInput(user.phone) : "—"}</p>
          <p className="text-caption text-ink/50">{t("phoneHidden")}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-caption text-ink/60">{t("language")}</p>
        <div className="flex gap-2">
          {routing.locales.map((l) => (
            <Link
              key={l}
              href="/account"
              locale={l}
              className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
                l === locale ? "border-navy bg-navy text-white" : "border-ink/15"
              }`}
            >
              {localeNames[l]}
            </Link>
          ))}
        </div>
      </section>

      {referralStats?.code && <ReferralCard stats={referralStats} reward={Number(rewardSetting?.value ?? 0)} />}

      <PushToggle />

      <PushPrefs
        muted={(profile?.push_muted as string[] | undefined) ?? []}
        quietNight={Boolean(profile?.push_quiet_night)}
      />

      <PriceWatches watches={(watches ?? []) as { id: string; make: string; model: string; year: number }[]} />

      {dealer?.status === "approved" && (
        <AlertPrefs
          enabled={(profile?.notify_new_auction as boolean | undefined) ?? true}
          makes={(profile?.notify_makes as string[] | undefined) ?? []}
          conditions={{
            yearFrom: profile?.notify_year_from ? String(profile.notify_year_from) : "",
            yearTo: profile?.notify_year_to ? String(profile.notify_year_to) : "",
            maxKm: profile?.notify_max_km ? String(profile.notify_max_km) : "",
            noAccident: Boolean(profile?.notify_no_accident),
          }}
        />
      )}

      <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-caption text-ink/60">{t("dealer")}</p>
          {dealer ? (
            <p className="flex flex-wrap items-center gap-x-2 text-body font-semibold">
              {dealer.business_name} <StatusBadge kind="dealer" status={dealer.status} />
            </p>
          ) : (
            <p className="text-body">{t("notDealer")}</p>
          )}
        </div>
        <Link href={dealer ? "/dealer/activity" : "/dealer/apply"} className="shrink-0 text-body font-semibold text-steppe">
          {dealer ? t("dealerActivity") : t("becomeDealer")} →
        </Link>
      </section>

      <Link href="/support" className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <span className="text-body font-semibold">💬 {t("support")}</span>
        <span className="text-ink/40">›</span>
      </Link>

      <LogoutButton />
      <DeleteAccount />
    </div>
  );
}
