import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DevPhoneLoginForm } from "./dev-phone-login-form";
import { LoginForm } from "./login-form";

// 출시 전까지는 인증번호 없는 전화번호 로그인. 문자 인증은 NEXT_PUBLIC_AUTH_MODE=phone 으로 켠다.
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
  return usePhoneLogin ? <LoginForm next={target} /> : <DevPhoneLoginForm next={target} />;
}
