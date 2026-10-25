import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

const allowedNext = ["/sell", "/dealer", "/admin"] as const;

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const { next } = await searchParams;
  const target = allowedNext.find((path) => path === next) ?? "/sell";

  return isSupabaseConfigured ? <LoginForm next={target} /> : <SetupNotice />;
}
