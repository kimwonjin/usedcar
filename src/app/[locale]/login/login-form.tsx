"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: "/sell" | "/dealer" | "/admin" }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [phone, setPhone] = useState("+7");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    if (step === "phone") {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) setMessage(t("error"));
      else {
        setStep("code");
        setMessage(t("sent"));
      }
    } else {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) setMessage(t("error"));
      else {
        router.replace(next);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 pt-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>

      {step === "phone" ? (
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
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-caption text-ink/70">{t("code")}</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="price h-14 rounded-xl border border-ink/15 bg-white px-4 text-title tracking-[0.3em]"
          />
        </label>
      )}

      {message && <p className="text-caption text-ink/70">{message}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-auto h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-50"
      >
        {step === "phone" ? t("sendCode") : t("verify")}
      </button>
    </form>
  );
}
