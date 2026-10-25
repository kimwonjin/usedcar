"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { POPULAR_MAKES } from "@/lib/car-catalog";
import { createClient } from "@/lib/supabase/client";

// 이름: 거래 채팅에서 상대에게 보이는 이름
export function NameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", data.user.id);
      if (!error) {
        setSaved(true);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-ink/60">{t("name")}</span>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={50}
          placeholder={t("namePlaceholder")}
          className="h-12 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-subtitle"
        />
        <button
          type="button"
          disabled={busy || name.trim() === initialName.trim()}
          onClick={save}
          className="h-12 shrink-0 rounded-lg bg-navy px-4 text-body font-semibold text-white disabled:opacity-40"
        >
          {saved ? "✓" : t("save")}
        </button>
      </div>
      <span className="text-caption text-ink/50">{t("nameHint")}</span>
    </label>
  );
}

export function LogoutButton() {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className="h-12 rounded-xl border border-ink/15 bg-white text-body text-ink/70"
    >
      {t("logout")}
    </button>
  );
}

export type AlertConditions = { yearFrom: string; yearTo: string; maxKm: string; noAccident: boolean };

// 딜러 새 매물 알림 설정: 끄기, 원하는 제조사만 (아무것도 고르지 않으면 전체), 연식·주행거리·무사고 조건
export function AlertPrefs({
  enabled,
  makes,
  conditions: initialConditions,
}: {
  enabled: boolean;
  makes: string[];
  conditions: AlertConditions;
}) {
  const t = useTranslations("account");
  const [on, setOn] = useState(enabled);
  const [selected, setSelected] = useState<string[]>(makes);
  const [conditions, setConditions] = useState(initialConditions);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "failed">("idle");

  async function save(nextOn: boolean, nextMakes: string[], next: AlertConditions = conditions) {
    setState("busy");
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const num = (v: string) => (v ? Number(v) : null);
    const { error } = data.user
      ? await supabase
          .from("profiles")
          .update({
            notify_new_auction: nextOn,
            notify_makes: nextMakes,
            notify_year_from: num(next.yearFrom),
            notify_year_to: num(next.yearTo),
            notify_max_km: num(next.maxKm),
            notify_no_accident: next.noAccident,
          })
          .eq("id", data.user.id)
      : { error: true };
    setState(error ? "failed" : "saved");
  }

  const setCondition = (patch: Partial<AlertConditions>, saveNow = false) => {
    const next = { ...conditions, ...patch };
    setConditions(next);
    setState("idle");
    if (saveNow) save(on, selected, next);
  };
  const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
  const yearOk = (v: string) => !v || (Number(v) >= 1960 && Number(v) <= 2100);
  const conditionsValid = yearOk(conditions.yearFrom) && yearOk(conditions.yearTo);

  const toggleMake = (make: string) => {
    const next = selected.includes(make) ? selected.filter((m) => m !== make) : [...selected, make];
    setSelected(next);
    save(on, next);
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-body font-semibold">{t("newAuctionAlerts")}</span>
          <span className="text-caption text-ink/60">{t("newAuctionAlertsHint")}</span>
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            save(e.target.checked, selected);
          }}
          className="size-5"
        />
      </label>
      {on && (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink/60">{t("makesHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(POPULAR_MAKES).map((make) => (
              <button
                key={make}
                type="button"
                aria-pressed={selected.includes(make)}
                onClick={() => toggleMake(make)}
                className={`rounded-full border px-2.5 py-1 text-caption font-semibold ${
                  selected.includes(make) ? "border-navy bg-navy text-white" : "border-ink/15"
                }`}
              >
                {make}
              </button>
            ))}
          </div>
          <p className="mt-2 text-caption text-ink/60">{t("conditionsHint")}</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["yearFrom", t("yearFrom"), 4, "2015"],
                ["yearTo", t("yearTo"), 4, "2024"],
                ["maxKm", t("maxKm"), 7, "150000"],
              ] as const
            ).map(([key, label, max, placeholder]) => (
              <label key={key} className="flex flex-col gap-1 text-caption text-ink/60">
                {label}
                <input
                  inputMode="numeric"
                  value={conditions[key]}
                  placeholder={placeholder}
                  onChange={(e) => setCondition({ [key]: digits(e.target.value, max) })}
                  onBlur={() => conditionsValid && save(on, selected)}
                  className="price h-10 rounded-lg border border-ink/15 px-2 text-body text-ink"
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={conditions.noAccident}
              onChange={(e) => setCondition({ noAccident: e.target.checked }, true)}
              className="size-5 accent-navy"
            />
            {t("noAccidentOnly")}
          </label>
        </div>
      )}
      {state === "saved" && <p className="text-caption text-success">✓ {t("prefsSaved")}</p>}
      {state === "failed" && <p className="text-caption text-danger">{t("prefsFailed")}</p>}
    </section>
  );
}

// 회원 탈퇴: 진행 중인 경매·거래·미납이 있으면 막는다
export function DeleteAccount() {
  const t = useTranslations("account");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      const key = ["active auctions", "active deals", "unpaid payments"].find((k) => error.message.includes(k));
      setError(key ? t(`deleteBlocked.${key.replace(" ", "_")}` as Parameters<typeof t>[0]) : t("deleteFailed"));
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-caption text-ink/40 underline">
        {t("deleteAccount")}
      </button>
    );
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-white p-4">
      <p className="text-body font-semibold text-danger">{t("deleteTitle")}</p>
      <p className="text-caption text-ink/70">{t("deleteHint")}</p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={t("deleteConfirmWord")}
        className="h-11 rounded-lg border border-ink/15 px-3"
      />
      {error && <p className="text-caption text-danger">{error}</p>}
      <button
        type="button"
        disabled={busy || confirmText.trim() !== t("deleteConfirmWord")}
        onClick={remove}
        className="h-11 rounded-lg bg-danger font-semibold text-white disabled:opacity-40"
      >
        {t("deleteAccount")}
      </button>
    </section>
  );
}
