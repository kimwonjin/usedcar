import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, getDealer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ApplyForm } from "./apply-form";

// D1 딜러 가입 신청 (거절되면 같은 화면에서 고쳐서 재신청)
export default async function DealerApplyPage({ params }: PageProps<"/[locale]/dealer/apply">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  if (!isSupabaseConfigured) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });
  const dealer = await getDealer(user.id);
  if (dealer?.status === "approved" || dealer?.status === "suspended") {
    return redirect({ href: "/dealer", locale });
  }

  return <ApplyForm userId={user.id} dealer={dealer} />;
}
