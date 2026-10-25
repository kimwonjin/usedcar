import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { EmailLoginForm } from "./email-login-form";
import { LoginForm } from "./login-form";

// 출시 전까지는 이메일 로그인. 휴대폰 OTP는 NEXT_PUBLIC_AUTH_MODE=phone 으로 켠다.
const usePhoneLogin = process.env.NEXT_PUBLIC_AUTH_MODE === "phone";

const allowedNext = ["/sell", "/dealer", "/admin"] as const;

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const { next } = await searchParams;
  const target = allowedNext.find((path) => path === next) ?? "/sell";

  if (!isSupabaseConfigured) return <SetupNotice />;
  return usePhoneLogin ? <LoginForm next={target} /> : <EmailLoginForm next={target} />;
}
