import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DevPhoneLoginForm } from "./dev-phone-login-form";
import { LoginForm } from "./login-form";

// 출시 전까지는 인증번호 없는 전화번호 로그인. 문자 인증은 NEXT_PUBLIC_AUTH_MODE=phone 으로 켠다.
const usePhoneLogin = process.env.NEXT_PUBLIC_AUTH_MODE === "phone";

const allowedNext = ["/sell", "/dealer", "/admin"];

// 로그인 후 이동할 곳. 다른 사이트로 보내지 못하도록 정해진 경로만 허용한다
function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/sell";
  if (allowedNext.includes(next)) return next;
  // 시세 조회에서 넘어온 차량 등록 (제조사·모델·연식을 미리 채움)
  if (/^\/sell\/new(\?[A-Za-z0-9%=&.+_-]*)?$/.test(next)) return next;
  return "/sell";
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const { next } = await searchParams;
  const target = safeNext(next);

  if (!isSupabaseConfigured) return <SetupNotice />;
  return usePhoneLogin ? <LoginForm next={target} /> : <DevPhoneLoginForm next={target} />;
}
