"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePush } from "@/lib/push";

// 푸시 알림 켜기 카드. compact면 꺼져 있을 때만 배너로 보인다(목록 화면 상단용).
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("notificationCenter");
  const { state, enable, disable } = usePush();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (state === "loading") return null;
  if (compact && state !== "off") return null;

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    const ok = await enable().catch(() => false);
    if (!ok) setFailed(true);
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-steppe/30 bg-steppe/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold">🔔 {t("pushTitle")}</p>
          <p className="text-caption text-ink/70">{state === "on" ? t("pushOn") : t("pushHint")}</p>
        </div>
        {state === "off" && (
          <button
            type="button"
            disabled={busy}
            onClick={turnOn}
            className="shrink-0 rounded-lg bg-navy px-3 py-2 text-caption font-bold text-white disabled:opacity-40"
          >
            {t("enablePush")}
          </button>
        )}
        {state === "on" && (
          <button type="button" onClick={disable} className="shrink-0 text-caption text-ink/50 underline">
            {t("disablePush")}
          </button>
        )}
      </div>
      {state === "denied" && <p className="text-caption text-danger">{t("pushDenied")}</p>}
      {state === "unsupported" && <p className="text-caption text-ink/60">{t("pushUnsupported")}</p>}
      {state === "ios-install" && <p className="text-caption text-ink/70">{t("iosHint")}</p>}
      {failed && <p className="text-caption text-danger">{t("pushFailed")}</p>}
    </section>
  );
}
