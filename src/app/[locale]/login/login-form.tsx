"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConsentNote } from "@/components/consent-note";
import { useRouter } from "@/i18n/navigation";
import { PhoneField } from "@/components/phone-field";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: "/sell" | "/dealer" | "/admin" }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setMessage(t("invalidPhone"));
      setBusy(false);
      return;
    }
    // 문자 인증은 국제 형식(+7…, +82…)으로 보낸다
    const e164 = `+${normalized}`;

    if (step === "phone") {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) setMessage(t("error"));
      else {
        setStep("code");
        setMessage(t("sent"));
      }
    } else {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" });
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
        <PhoneField label={t("phone")} value={phone} onChange={setPhone} />
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

      <div className="mt-auto flex flex-col gap-2">
        <ConsentNote />
        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-50"
        >
          {step === "phone" ? t("sendCode") : t("verify")}
        </button>
      </div>
    </form>
  );
}
