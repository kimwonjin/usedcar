"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 딜러 메모: 경매 차량마다 나만 보는 메모. 비우고 저장하면 지운다.
export function DealerNote({ auctionId, dealerId, initial }: { auctionId: string; dealerId: string; initial: string }) {
  const t = useTranslations("dealerNote");
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = body.trim() !== saved;

  async function save() {
    const text = body.trim();
    setState("saving");
    const table = createClient().from("dealer_notes");
    const { error } = text
      ? await table.upsert({ dealer_id: dealerId, auction_id: auctionId, body: text, updated_at: new Date().toISOString() })
      : await table.delete().eq("dealer_id", dealerId).eq("auction_id", auctionId);
    if (error) {
      setState("error");
      return;
    }
    setSaved(text);
    setBody(text);
    setState("saved");
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-subtitle font-semibold">📝 {t("title")}</h2>
        <span className="text-caption text-ink/50">{t("private")}</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setState("idle");
        }}
        maxLength={1000}
        rows={3}
        placeholder={t("placeholder")}
        aria-label={t("title")}
        className="rounded-lg border border-ink/15 p-3 text-body"
      />
      <div className="flex items-center justify-end gap-3">
        {state === "saved" && !dirty && <span className="text-caption text-steppe">✓ {t("saved")}</span>}
        {state === "error" && <span className="text-caption text-danger">{t("failed")}</span>}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || state === "saving"}
          className="rounded-lg bg-navy px-4 py-2 text-body font-semibold text-white disabled:opacity-40"
        >
          {t("save")}
        </button>
      </div>
    </section>
  );
}
