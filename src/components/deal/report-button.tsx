"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REASONS = ["fraud", "no_show", "rude", "misleading", "other"] as const;

// 거래 상대 신고: 관리자에게 전달된다
export function ReportButton({ dealId }: { dealId: string }) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("fraud");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit() {
    setState("busy");
    const { error } = await createClient().rpc("report_deal", { p_deal_id: dealId, p_reason: reason, p_detail: detail });
    setState(error ? "error" : "done");
  }

  if (state === "done") return <p className="text-center text-caption text-ink/60">✓ {t("done")}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-caption text-ink/40 underline">
        🚩 {t("open")}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-4">
      <p className="text-body font-semibold">{t("title")}</p>
      {REASONS.map((r) => (
        <label key={r} className="flex items-center gap-2 text-body">
          <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
          {t(`reasons.${r}`)}
        </label>
      ))}
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("detailPlaceholder")}
        className="rounded-lg border border-ink/15 p-2 text-body"
      />
      {state === "error" && <p className="text-caption text-danger">{t("failed")}</p>}
      <button type="button" disabled={state === "busy"} onClick={submit} className="h-11 rounded-lg bg-danger font-semibold text-white disabled:opacity-40">
        {t("submit")}
      </button>
    </div>
  );
}
