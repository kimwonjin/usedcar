"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";

export type PenaltyRow = {
  id: string;
  reason: string;
  action: string;
  note: string | null;
  created_at: string;
  revoked_at: string | null;
  revoke_note: string | null;
};

// 딜러 패널티 이력: 잘못된 노쇼 신고 등은 한 건씩 철회한다
export function PenaltyList({ penalties }: { penalties: PenaltyRow[] }) {
  const t = useTranslations("admin");
  const tp = useTranslations("penalty");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  // 새로 고침이 끝날 때까지 버튼을 막아 두 번 누르지 않게 한다
  const [refreshing, startRefresh] = useTransition();

  async function revoke(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    setBusy(id);
    setError(false);
    const { error } = await createClient().rpc("revoke_penalty", { p_penalty_id: id, p_note: notes[id]?.trim() ?? "" });
    setBusy(null);
    if (error) setError(true);
    else startRefresh(() => router.refresh());
  }

  if (penalties.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3">
      <p className="text-caption font-semibold">{t("penaltyHistory")}</p>
      <ul className="flex flex-col gap-2 text-caption">
        {penalties.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <span className={p.revoked_at ? "text-ink/40 line-through" : ""}>
              {formatDateTime(p.created_at, locale)} · {tp(`reasons.${p.reason}` as Parameters<typeof tp>[0])} →{" "}
              <b>{tp(`actions.${p.action}` as Parameters<typeof tp>[0])}</b>
              {p.note && ` (${p.note})`}
            </span>
            {p.revoked_at ? (
              <span className="text-success">
                ✓ {tp("revoked")} {formatDateTime(p.revoked_at, locale)}
                {p.revoke_note && ` · ${p.revoke_note}`}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <input
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={t("revokeNotePlaceholder")}
                  maxLength={300}
                  className="h-8 w-56 rounded border border-ink/15 px-2"
                />
                <button
                  type="button"
                  disabled={busy !== null || refreshing}
                  onClick={() => revoke(p.id)}
                  className="h-8 rounded border border-ink/20 px-3 font-semibold disabled:opacity-40"
                >
                  {t("revoke")}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
    </div>
  );
}
