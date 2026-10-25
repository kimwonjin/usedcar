"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const LANGS = ["ko", "ru", "kk"] as const;

// 새 공지: 대상·배너 여부·기간·링크 + 언어별 제목·내용 (최소 한 언어 제목 필수)
export function NoticeForm({ userId }: { userId: string }) {
  const t = useTranslations("notices");
  const router = useRouter();
  const [audience, setAudience] = useState<"all" | "sellers" | "dealers">("all");
  const [pinned, setPinned] = useState(true);
  const [endsAt, setEndsAt] = useState("");
  const [link, setLink] = useState("");
  const [title, setTitle] = useState<Record<string, string>>({ ko: "", ru: "", kk: "" });
  const [body, setBody] = useState<Record<string, string>>({ ko: "", ru: "", kk: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const clean = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).filter(([, s]) => s.trim()).map(([k, s]) => [k, s.trim()]));
  const valid = Object.keys(clean(title)).length > 0 && (!link || /^\/[A-Za-z0-9/_?=&.-]*$/.test(link));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const { error } = await createClient()
      .from("announcements")
      .insert({
        audience,
        pinned,
        title: clean(title),
        body: clean(body),
        link: link.trim() || null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        created_by: userId,
      });
    setBusy(false);
    if (error) {
      setError(true);
      return;
    }
    setTitle({ ko: "", ru: "", kk: "" });
    setBody({ ko: "", ru: "", kk: "" });
    setLink("");
    setEndsAt("");
    router.refresh();
  }

  const field = "h-11 rounded-lg border border-ink/15 bg-white px-3 text-body";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">{t("new")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("audienceLabel")}
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={field}>
            {(["all", "sellers", "dealers"] as const).map((a) => (
              <option key={a} value={a}>
                {t(`audience.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("endsAt")}
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("link")}
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/price" className={field} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-5 accent-navy" />
        {t("pinned")}
      </label>
      {LANGS.map((lang) => (
        <fieldset key={lang} className="flex flex-col gap-2 rounded-lg border border-ink/10 p-3">
          <legend className="px-1 text-caption font-semibold text-ink/60">{lang.toUpperCase()}</legend>
          <input
            value={title[lang]}
            onChange={(e) => setTitle({ ...title, [lang]: e.target.value })}
            placeholder={t("titleField")}
            maxLength={120}
            className={field}
          />
          <textarea
            value={body[lang]}
            onChange={(e) => setBody({ ...body, [lang]: e.target.value })}
            placeholder={t("bodyField")}
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-ink/15 p-3 text-body"
          />
        </fieldset>
      ))}
      <p className="text-caption text-ink/50">{t("langHint")}</p>
      {error && <p className="text-caption text-danger">{t("failed")}</p>}
      <button type="submit" disabled={!valid || busy} className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40">
        {t("publish")}
      </button>
    </form>
  );
}

// 게시 중인 공지를 바로 내리기
export function EndNoticeButton({ id }: { id: string }) {
  const t = useTranslations("notices");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", id);
        router.refresh();
      }}
      className="rounded-lg border border-ink/15 px-3 py-1.5 text-caption font-semibold"
    >
      {t("endNow")}
    </button>
  );
}
