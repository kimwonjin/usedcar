"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const KEY = "satu-ref";
const TTL_MS = 30 * 24 * 3600 * 1000;

// 모든 화면에 깔리는 추천 코드 처리: ?ref=코드로 들어오면 30일 동안 기억하고,
// 로그인 상태가 되면 한 번 등록한다 (가입 7일 안·거래 전 사용자만 DB에서 받아 준다)
export function ReferralCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (code && /^[A-Za-z0-9]{6}$/.test(code)) localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    } catch {}

    const supabase = createClient();
    async function claim() {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { code: string; at: number } | null;
        if (!saved) return;
        if (Date.now() - saved.at > TTL_MS) return localStorage.removeItem(KEY);
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const { error } = await supabase.rpc("claim_referral", { p_code: saved.code });
        if (!error) localStorage.removeItem(KEY); // 받아 주든 안 받아 주든 한 번만 시도
      } catch {}
    }
    claim();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") claim();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}

export type ReferralStats = { code: string; invited: number; completed: number; pending_amount: number; paid_amount: number };

// 내 정보 화면: 친구 초대 링크와 현황
export function ReferralCard({ stats, reward }: { stats: ReferralStats; reward: number }) {
  const t = useTranslations("referral");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/${locale}?ref=${stats.code}`;
    const text = t("shareText", { amount: formatTenge(reward) });
    if (navigator.share) {
      try {
        await navigator.share({ title: "Garajym", text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("copyPrompt"), url);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-subtitle font-semibold">🎁 {t("title")}</h2>
        <p className="text-caption text-ink/60">{t("hint", { amount: formatTenge(reward) })}</p>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
        <span className="text-caption text-ink/60">{t("myCode")}</span>
        <span className="price text-subtitle font-bold tracking-widest">{stats.code}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-caption">
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-ink/60">{t("invited")}</dt>
          <dd className="price text-body font-bold">{stats.invited}</dd>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-ink/60">{t("sold")}</dt>
          <dd className="price text-body font-bold">{stats.completed}</dd>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-ink/60">{t("pending")}</dt>
          <dd className="price text-body font-bold">{formatTenge(stats.pending_amount)}</dd>
        </div>
      </dl>
      {stats.paid_amount > 0 && <p className="text-caption text-ink/60">{t("paid", { amount: formatTenge(stats.paid_amount) })}</p>}
      <button type="button" onClick={share} className="h-12 rounded-xl bg-steppe font-bold text-white">
        {copied ? `✓ ${t("copied")}` : t("share")}
      </button>
      <p className="text-caption text-ink/50">{t("terms")}</p>
    </section>
  );
}
