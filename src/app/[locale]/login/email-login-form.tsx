"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 개발 기간용 이메일 로그인. 출시 전에 휴대폰 OTP(LoginForm)로 바꾼다.
export function EmailLoginForm({ next }: { next: "/sell" | "/dealer" | "/admin" }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signIn" | "signUp") {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) setMessage(error.message);
    else if (!data.session) setMessage(t("confirmEmail"));
    else {
      router.replace(next);
      router.refresh();
    }
    setBusy(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit("signIn");
  }

  const inputClass = "h-14 rounded-xl border border-ink/15 bg-white px-4 text-subtitle";

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pt-6">
      <h1 className="text-title font-bold text-navy">{t("emailTitle")}</h1>
      <p className="text-caption text-ink/60">{t("devNotice")}</p>

      <label className="flex flex-col gap-2">
        <span className="text-caption text-ink/70">{t("email")}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-caption text-ink/70">{t("password")}</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      {message && <p className="text-caption text-danger">{message}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-50"
        >
          {t("signIn")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("signUp")}
          className="h-12 rounded-xl text-subtitle font-semibold text-steppe disabled:opacity-50"
        >
          {t("signUp")}
        </button>
      </div>
    </form>
  );
}
