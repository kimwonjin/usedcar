import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { almatyYear } from "@/lib/time";
import { CarWizard } from "./car-wizard";

// S3~S5 차량 등록
export default async function NewCarPage({ params }: PageProps<"/[locale]/sell/new">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  if (!isSupabaseConfigured) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/sell", locale });

  return <CarWizard userId={user.id} currentYear={almatyYear()} />;
}
