"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["account", "selling", "buying", "payment", "bug", "other"] as const;

// 새 문의: 문의를 만들고 첫 글을 남긴 뒤 상세 화면으로 이동
export function NewTicketForm({ userId }: { userId: string }) {
  const t = useTranslations("support");
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("selling");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: userId, category, subject: subject.trim() })
      .select("id")
      .single();
    if (!error && data) {
      const { error: msgError } = await supabase
        .from("support_messages")
        .insert({ ticket_id: data.id, sender_id: userId, body: body.trim() });
      if (!msgError) {
        router.push(`/support/${data.id}`);
        router.refresh();
        return;
      }
    }
    setError(true);
    setBusy(false);
  }

  const select = "h-12 rounded-lg border border-ink/15 bg-white px-3 text-body";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">{t("newTitle")}</h2>
      <label className="flex flex-col gap-1 text-caption text-ink/60">
        {t("category")}
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={select}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-caption text-ink/60">
        {t("subject")}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={select} />
      </label>
      <label className="flex flex-col gap-1 text-caption text-ink/60">
        {t("body")}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={t("bodyPlaceholder")}
          className="rounded-lg border border-ink/15 p-3 text-body text-ink"
        />
      </label>
      {error && <p className="text-caption text-danger">{t("failed")}</p>}
      <button
        type="submit"
        disabled={busy || !subject.trim() || !body.trim()}
        className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40"
      >
        {t("submit")}
      </button>
    </form>
  );
}
