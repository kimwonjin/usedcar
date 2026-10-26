"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { MIN_YEAR } from "@/lib/car-catalog";
import { formatDate } from "@/lib/datetime";
import { formatKm, formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Estimate = { sample: number; avg_price: number | null; min_price: number | null; max_price: number | null };
type Sale = { year: number; mileage_km: number; price: number; completed_at: string };
type Result = { make: string; model: string; year: number; estimate: Estimate; sales: Sale[] };

export function PriceLookup({
  makes,
  currentYear,
  initial,
}: {
  makes: Record<string, string[]>;
  currentYear: number;
  initial: { make: string; model: string; year: string };
}) {
  const t = useTranslations("priceLookup");
  const tc = useTranslations("estimate");
  const locale = useLocale();
  const router = useRouter();
  const [make, setMake] = useState(initial.make);
  const [model, setModel] = useState(initial.model);
  const [year, setYear] = useState(initial.year);
  const [watch, setWatch] = useState<"idle" | "busy" | "on" | "limit" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  const models = makes[make] ?? [];
  const yearNum = Number(year);
  const valid = make.trim() && model.trim() && yearNum >= MIN_YEAR && yearNum <= currentYear + 1;

  const run = useCallback(async () => {
    setBusy(true);
    setWatch("idle");
    setFailed(false);
    const supabase = createClient();
    const args = { p_make: make.trim(), p_model: model.trim(), p_year: Number(year) };
    const [est, sales] = await Promise.all([
      supabase.rpc("estimate_price", args),
      supabase.rpc("comparable_sales", { ...args, p_limit: 5 }),
    ]);
    setBusy(false);
    if (est.error || sales.error) {
      setFailed(true);
      return;
    }
    setResult({
      make: args.p_make,
      model: args.p_model,
      year: Number(year),
      estimate: ((est.data as Estimate[] | null)?.[0] ?? { sample: 0 }) as Estimate,
      sales: (sales.data ?? []) as Sale[],
    });
  }, [make, model, year]);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    if (valid) run();
  }

  // 주소에 차종이 있으면 처음에 한 번 바로 조회
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial.make && initial.model && initial.year) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 매달 시세 알림 신청 (로그인 필요)
  async function subscribe() {
    if (!result) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const query = new URLSearchParams({ make: result.make, model: result.model, year: String(result.year) });
    if (!data.user) {
      router.push(`/login?next=${encodeURIComponent(`/price?${query}`)}`);
      return;
    }
    setWatch("busy");
    const { error } = await supabase
      .from("price_watches")
      .upsert({ user_id: data.user.id, make: result.make, model: result.model, year: result.year }, { onConflict: "user_id,make,model,year" });
    setWatch(error ? (error.message.includes("too many") ? "limit" : "failed") : "on");
  }

  const field = "h-12 w-full rounded-lg border border-ink/15 bg-white px-3 text-body";
  const sellHref = result
    ? `/sell/new?${new URLSearchParams({ make: result.make, model: result.model, year: String(result.year) })}`
    : "/sell/new";

  return (
    <>
      <form onSubmit={lookup} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("make")}
          <input
            list="price-makes"
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            placeholder="Toyota"
            className={field}
          />
          <datalist id="price-makes">
            {Object.keys(makes).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("model")}
          <input list="price-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={models[0] ?? "Camry"} className={field} />
          <datalist id="price-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("year")}
          <input
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={String(currentYear - 5)}
            className={`${field} price`}
          />
        </label>
        <button type="submit" disabled={!valid || busy} className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40">
          {busy ? t("loading") : t("submit")}
        </button>
        {failed && <p className="text-caption text-danger">{t("failed")}</p>}
      </form>

      {result && (
        <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-caption text-ink/60">
            {result.make} {result.model} · {t("yearRange", { from: result.year - 2, to: result.year + 2 })}
          </p>
          {result.estimate.sample && result.estimate.avg_price ? (
            <>
              <div>
                <p className="text-caption text-ink/60">{t("average")}</p>
                <p className="price text-price font-bold text-gold">{formatTenge(result.estimate.avg_price)}</p>
                <p className="price text-caption text-ink/60">
                  {tc("range", {
                    min: formatTenge(result.estimate.min_price ?? 0),
                    max: formatTenge(result.estimate.max_price ?? 0),
                    count: result.estimate.sample,
                  })}
                </p>
                {result.estimate.sample < 5 && <p className="text-caption text-ink/50">{tc("lowSample")}</p>}
              </div>
              {result.sales.length > 0 && (
                <div>
                  <p className="mb-1 text-caption font-semibold text-ink/60">{t("recent")}</p>
                  <ul className="divide-y divide-ink/10">
                    {result.sales.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2 text-body">
                        <span className="text-ink/70">
                          {s.year} · {formatKm(s.mileage_km)} · {formatDate(s.completed_at, locale)}
                        </span>
                        <span className="price font-semibold">{formatTenge(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-body text-ink/70">{t("noData")}</p>
          )}
          <p className="text-caption text-ink/50">{t("note")}</p>
          <button
            type="button"
            onClick={subscribe}
            disabled={watch === "busy" || watch === "on"}
            className="h-12 rounded-xl border border-navy font-semibold text-navy disabled:opacity-60"
          >
            {watch === "on" ? `✓ ${t("watchOn")}` : `🔔 ${t("watch")}`}
          </button>
          {watch === "limit" && <p className="text-caption text-danger">{t("watchLimit")}</p>}
          {watch === "failed" && <p className="text-caption text-danger">{t("failed")}</p>}
          <Link href={sellHref} className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white">
            {t("cta")}
          </Link>
        </section>
      )}
    </>
  );
}
