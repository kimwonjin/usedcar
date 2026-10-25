import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PushToggle } from "@/components/push-toggle";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser, getDealer, getUserId } from "@/lib/auth";
import { formatPhoneInput } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { AlertPrefs, DeleteAccount, LogoutButton, NameForm } from "./account-forms";

const localeNames = { ko: "한국어", ru: "Русский", kk: "Қазақша" } as const;

// 내 정보: 이름, 전화번호(변경 불가), 언어, 푸시 알림, 딜러 상태, 로그아웃
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login", locale });
  const supabase = await createClient();
  const [user, { data: profile }, dealer] = await Promise.all([
    getCurrentUser(),
    supabase.from("profiles").select("full_name, notify_new_auction, notify_makes, notify_year_from, notify_year_to, notify_max_km, notify_no_accident").eq("id", userId).maybeSingle(),
    getDealer(userId),
  ]);
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

      <PushToggle />

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

      <section className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-caption text-ink/60">{t("dealer")}</p>
          {dealer ? (
            <p className="flex items-center gap-2 text-body font-semibold">
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
