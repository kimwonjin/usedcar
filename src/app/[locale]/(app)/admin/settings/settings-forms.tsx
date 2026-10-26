"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PriceInput } from "@/components/price-input";
import { useRouter } from "@/i18n/navigation";
import type { FeeBand } from "@/lib/fees";
import { createClient } from "@/lib/supabase/client";

// 수수료 구간표: 위에서부터 "이 금액 이하면 수수료 얼마". 마지막 줄은 그 이상 전부
export function FeeBandsEditor({ initial }: { initial: FeeBand[] }) {
  const t = useTranslations("adminSettings");
  const router = useRouter();
  const [rows, setRows] = useState(initial.map((b) => ({ max: b.max_price ? String(b.max_price) : "", fee: String(b.fee) })));
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  const update = (i: number, key: "max" | "fee", value: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  // 상한은 위에서 아래로 커져야 하고, 마지막 줄만 상한이 비어 있어야 한다
  const valid =
    rows.length > 0 &&
    rows.every((r, i) => r.fee !== "" && (i === rows.length - 1 ? r.max === "" : Number(r.max) > 0)) &&
    rows.slice(0, -1).every((r, i) => i === 0 || Number(r.max) > Number(rows[i - 1].max));

  async function save() {
    setState("busy");
    const supabase = createClient();
    const { error: delError } = await supabase.from("fee_bands").delete().gte("id", 0);
    const { error } = delError
      ? { error: delError }
      : await supabase.from("fee_bands").insert(rows.map((r) => ({ max_price: r.max ? Number(r.max) : null, fee: Number(r.fee) })));
    setState(error ? "error" : "saved");
    if (!error) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          {i === rows.length - 1 ? (
            <p className="text-caption text-ink/60">{t("andAbove")}</p>
          ) : (
            <PriceInput value={row.max} onChange={(v) => update(i, "max", v)} placeholder={t("maxPrice")} />
          )}
          <PriceInput value={row.fee} onChange={(v) => update(i, "fee", v)} placeholder={t("fee")} />
          <button
            type="button"
            disabled={rows.length <= 1 || i === rows.length - 1}
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            className="h-10 rounded-lg px-2 text-caption text-ink/50 disabled:opacity-0"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev.slice(0, -1), { max: "", fee: "" }, prev[prev.length - 1]])}
        className="h-10 self-start rounded-lg border border-ink/15 px-3 text-caption font-semibold text-steppe"
      >
        + {t("addBand")}
      </button>
      {!valid && <p className="text-caption text-danger">{t("invalidBands")}</p>}
      <button type="button" disabled={!valid || state === "busy"} onClick={save} className="h-11 rounded-lg bg-navy font-semibold text-white disabled:opacity-40">
        {state === "saved" ? `✓ ${t("saved")}` : t("save")}
      </button>
      {state === "error" && <p className="text-caption text-danger">{t("failed")}</p>}
    </div>
  );
}

type Settings = {
  payments_mode: string;
  fee_due_days: string;
  block_bidding_on_overdue: string;
  auction_review: string;
  referral_reward: string;
  fees_enabled: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations("adminSettings");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  async function save() {
    setState("busy");
    const { error } = await createClient()
      .from("app_settings")
      .upsert(Object.entries(values).map(([key, value]) => ({ key, value })));
    setState(error ? "error" : "saved");
    if (!error) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-body">
        <input
          type="checkbox"
          checked={values.fees_enabled !== "off"}
          onChange={(e) => setValues({ ...values, fees_enabled: e.target.checked ? "on" : "off" })}
          className="mt-1"
        />
        <span>
          {t("feesEnabled")}
          <span className="block text-caption text-ink/60">{t("feesEnabledHint")}</span>
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("paymentsMode")}</span>
        <select
          value={values.payments_mode}
          onChange={(e) => setValues({ ...values, payments_mode: e.target.value })}
          className="h-10 rounded-lg border border-ink/15 bg-white px-2"
        >
          <option value="mock">{t("modeMock")}</option>
          <option value="live">{t("modeLive")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("dueDays")}</span>
        <input
          inputMode="numeric"
          value={values.fee_due_days}
          onChange={(e) => setValues({ ...values, fee_due_days: e.target.value.replace(/\D/g, "").slice(0, 3) })}
          className="h-10 rounded-lg border border-ink/15 bg-white px-3"
        />
      </label>
      <label className="flex items-center gap-2 text-body">
        <input
          type="checkbox"
          checked={values.block_bidding_on_overdue === "true"}
          onChange={(e) => setValues({ ...values, block_bidding_on_overdue: String(e.target.checked) })}
        />
        {t("blockOnOverdue")}
      </label>
      <label className="flex items-start gap-2 text-body">
        <input
          type="checkbox"
          checked={values.auction_review === "on"}
          onChange={(e) => setValues({ ...values, auction_review: e.target.checked ? "on" : "off" })}
          className="mt-1"
        />
        <span>
          {t("auctionReview")}
          <span className="block text-caption text-ink/60">{t("auctionReviewHint")}</span>
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("referralReward")}</span>
        <input
          inputMode="numeric"
          value={values.referral_reward}
          onChange={(e) => setValues({ ...values, referral_reward: e.target.value.replace(/\D/g, "").slice(0, 7) })}
          className="h-10 rounded-lg border border-ink/15 bg-white px-3"
        />
      </label>
      <button
        type="button"
        disabled={state === "busy" || !values.fee_due_days || values.referral_reward === ""}
        onClick={save}
        className="h-11 rounded-lg bg-navy font-semibold text-white disabled:opacity-40"
      >
        {state === "saved" ? `✓ ${t("saved")}` : t("save")}
      </button>
      {state === "error" && <p className="text-caption text-danger">{t("failed")}</p>}
    </div>
  );
}
