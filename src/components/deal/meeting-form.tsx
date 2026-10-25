"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toLocalInputValue } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";

// 만남 일정·장소. 판매자·딜러 누구나 수정할 수 있다.
export function MeetingForm({
  dealId,
  meetingAt,
  meetingPlace,
  editable,
}: {
  dealId: string;
  meetingAt: string | null;
  meetingPlace: string | null;
  editable: boolean;
}) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [at, setAt] = useState(toLocalInputValue(meetingAt));
  const [place, setPlace] = useState(meetingPlace ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    const { error } = await createClient()
      .from("deals")
      .update({ meeting_at: at ? new Date(at).toISOString() : null, meeting_place: place.trim() || null })
      .eq("id", dealId);
    setBusy(false);
    if (!error) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">{t("meeting")}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("meetingAt")}</span>
        <input
          type="datetime-local"
          value={at}
          disabled={!editable}
          onChange={(e) => setAt(e.target.value)}
          className="h-12 rounded-lg border border-ink/15 bg-white px-3"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("meetingPlace")}</span>
        <input
          value={place}
          disabled={!editable}
          onChange={(e) => setPlace(e.target.value)}
          placeholder={t("meetingPlacePlaceholder")}
          className="h-12 rounded-lg border border-ink/15 bg-white px-3"
        />
      </label>
      {editable && (
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="h-11 rounded-lg border border-navy text-body font-semibold text-navy disabled:opacity-40"
        >
          {saved ? `✓ ${t("saved")}` : t("saveMeeting")}
        </button>
      )}
    </section>
  );
}
