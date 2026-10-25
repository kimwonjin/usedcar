"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { normalizeKzPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

// 개발 기간용: 인증번호 없이 전화번호만으로 로그인한다.
// 전화번호를 이메일·비밀번호 계정으로 바꿔 쓰므로 번호를 아는 사람은 누구나 그 계정에 들어갈 수 있다.
// 출시 전에 반드시 NEXT_PUBLIC_AUTH_MODE=phone(문자 인증)으로 바꾼다.
const devCredentials = (phone: string) => ({
  email: `${phone}@phone.satu.dev`,
  password: `satu-dev-${phone}`,
});

export function DevPhoneLoginForm({ next }: { next: "/sell" | "/dealer" | "/admin" }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [phone, setPhone] = useState("+7");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeKzPhone(phone);
    if (!normalized) {
      setMessage(t("invalidPhone"));
      return;
    }

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const credentials = devCredentials(normalized);

    let { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error?.code === "invalid_credentials") {
      ({ data, error } = await supabase.auth.signUp(credentials));
    }

    if (error || !data.session) {
      setMessage(error?.message ?? t("confirmEmailOn"));
      setBusy(false);
      return;
    }

    await supabase.from("profiles").update({ phone: `+${normalized}` }).eq("id", data.session.user.id);
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pt-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <p className="text-caption text-ink/60">{t("devNotice")}</p>

      <label className="flex flex-col gap-2">
        <span className="text-caption text-ink/70">{t("phone")}</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-14 rounded-xl border border-ink/15 bg-white px-4 text-subtitle"
          placeholder="+7 701 000 00 00"
        />
      </label>

      {message && <p className="text-caption text-danger">{message}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-auto h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-50"
      >
        {t("start")}
      </button>
    </form>
  );
}
