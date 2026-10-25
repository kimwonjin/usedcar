"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { DamageDiagram, DamageLegend } from "@/components/damage-diagram";
import {
  ACCIDENTS,
  CAR_OPTIONS,
  DAMAGE_KINDS,
  FUELS,
  MIN_YEAR,
  POPULAR_MAKES,
  REQUIRED_SLOTS,
  STEERINGS,
  TRANSMISSIONS,
  type Accident,
  type CarOption,
  type DamageMap,
  type Fuel,
  type Panel,
  type Steering,
  type Transmission,
} from "@/lib/car-catalog";
import { formatKm, formatThousands } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { PhotoStep, type PhotoMap } from "./photo-step";
import { PriceEstimate } from "./price-estimate";

type Draft = {
  plate: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
  fuel: Fuel;
  transmission: Transmission;
  steering: Steering;
  customsCleared: boolean;
  accident: Accident | "";
  owners: string;
  damage: DamageMap;
  options: CarOption[];
  defects: string;
  desiredPrice: string;
};

const STEPS = ["plate", "make", "model", "year", "mileage", "details", "history", "damage", "options", "defects", "photos", "review"] as const;
type Step = (typeof STEPS)[number];

const initialDraft: Draft = {
  plate: "",
  make: "",
  model: "",
  year: "",
  mileage: "",
  fuel: "petrol",
  transmission: "automatic",
  steering: "left",
  customsCleared: true,
  accident: "",
  owners: "",
  damage: {},
  options: [],
  defects: "",
  desiredPrice: "",
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export type WizardInitial = { carId: string; draft: Draft; photos: PhotoMap };

// S3 차량 정보 입력 → S4 사진 촬영 가이드 → S5 등록 확인. 한 화면에 질문 하나.
export function CarWizard({
  userId,
  currentYear,
  initial,
}: {
  userId: string;
  currentYear: number;
  initial?: WizardInitial;
}) {
  const t = useTranslations("carForm");
  const tc = useTranslations("condition");
  const router = useRouter();
  // 이어서 등록할 때는 사진 단계(사진이 다 있으면 확인 단계)부터 시작한다
  const [stepIndex, setStepIndex] = useState(() => {
    if (!initial) return 0;
    const complete = REQUIRED_SLOTS.every((slot) => initial.photos[slot]?.length);
    return STEPS.indexOf(complete ? "review" : "photos");
  });
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? initialDraft);
  const [carId, setCarId] = useState<string | null>(initial?.carId ?? null);
  const [photos, setPhotos] = useState<PhotoMap>(initial?.photos ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtherMake, setShowOtherMake] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  const step: Step = STEPS[stepIndex];
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const goTo = (target: Step) => {
    setError(null);
    setStepIndex(STEPS.indexOf(target));
  };

  const year = Number(draft.year);
  const photosComplete = REQUIRED_SLOTS.every((slot) => photos[slot]?.length);
  const canContinue: Record<Step, boolean> = {
    plate: /^[0-9A-Z]{5,10}$/.test(draft.plate),
    make: draft.make.trim().length > 0,
    model: draft.model.trim().length > 0,
    year: year >= MIN_YEAR && year <= currentYear + 1,
    mileage: draft.mileage.length > 0,
    details: true,
    history: draft.accident !== "" && draft.owners !== "",
    damage: true,
    options: true,
    defects: true,
    photos: photosComplete,
    review: photosComplete,
  };

  // 사진을 Storage에 올리려면 차량 id가 필요해서, 사진 단계로 넘어갈 때 차량을 저장한다.
  async function saveCar() {
    const supabase = createClient();
    const row = {
      seller_id: userId,
      plate_number: draft.plate,
      make: draft.make.trim(),
      model: draft.model.trim(),
      year,
      mileage_km: Number(draft.mileage),
      fuel: draft.fuel,
      transmission: draft.transmission,
      steering: draft.steering,
      customs_cleared: draft.customsCleared,
      accident: draft.accident || null,
      owners: Number(draft.owners) || null,
      damage: draft.damage,
      options: draft.options,
      defects: draft.defects.trim() || null,
    };
    if (carId) {
      const { error } = await supabase.from("cars").update(row).eq("id", carId);
      if (error) throw error;
      return;
    }
    const { data, error } = await supabase.from("cars").insert(row).select("id").single();
    if (error) throw error;
    setCarId(data.id as string);
  }

  async function startAuction() {
    if (!carId) return;
    const supabase = createClient();
    const desiredPrice = Number(draft.desiredPrice) || null;
    const { error: updateError } = await supabase
      .from("cars")
      .update({ desired_price: desiredPrice })
      .eq("id", carId);
    if (updateError) throw updateError;
    const { error } = await supabase.rpc("start_auction", { p_car_id: carId });
    if (error) throw error;
    router.replace("/sell");
    router.refresh();
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step === "defects") await saveCar();
      if (step === "review") {
        await startAuction();
        return; // 이동하는 동안 버튼을 잠가 둔다
      }
      setStepIndex((i) => i + 1);
    } catch {
      setError(t("error"));
    }
    setBusy(false);
  }

  const models = POPULAR_MAKES[draft.make] ?? [];
  const makeIsOther = draft.make !== "" && !(draft.make in POPULAR_MAKES);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (stepIndex === 0 ? router.push("/sell") : setStepIndex((i) => i - 1))}
          className="text-body text-ink/70"
        >
          ← {t("back")}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-steppe transition-all"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <span className="price text-caption text-ink/60">
          {stepIndex + 1}/{STEPS.length}
        </span>
      </div>

      {step === "plate" && (
        <Question title={t("plate.title")} hint={t("plate.hint")}>
          <input
            autoFocus
            value={draft.plate}
            onChange={(e) => set("plate", e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
            maxLength={10}
            placeholder="123ABC02"
            className={`${inputClass} price tracking-widest uppercase`}
          />
        </Question>
      )}

      {step === "make" && (
        <Question title={t("make.title")}>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(POPULAR_MAKES).map((make) => (
              <Chip
                key={make}
                selected={draft.make === make}
                onClick={() => {
                  setShowOtherMake(false);
                  setDraft((prev) => ({ ...prev, make, model: prev.make === make ? prev.model : "" }));
                }}
              >
                {make}
              </Chip>
            ))}
            <Chip
              selected={showOtherMake || makeIsOther}
              onClick={() => {
                setShowOtherMake(true);
                if (!makeIsOther) setDraft((prev) => ({ ...prev, make: "", model: "" }));
              }}
            >
              {t("make.other")}
            </Chip>
          </div>
          {(showOtherMake || makeIsOther) && (
            <input
              autoFocus
              value={draft.make}
              onChange={(e) => set("make", e.target.value)}
              placeholder={t("make.otherPlaceholder")}
              className={inputClass}
            />
          )}
        </Question>
      )}

      {step === "model" && (
        <Question title={t("model.title", { make: draft.make })} hint={models.length ? t("model.hint") : undefined}>
          {models.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <Chip key={model} selected={draft.model === model} onClick={() => set("model", model)}>
                  {model}
                </Chip>
              ))}
            </div>
          )}
          <input
            value={draft.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder={t("model.placeholder")}
            className={inputClass}
          />
        </Question>
      )}

      {step === "year" && (
        <Question title={t("year.title")} hint={t("year.hint")}>
          <input
            autoFocus
            inputMode="numeric"
            value={draft.year}
            onChange={(e) => set("year", digitsOnly(e.target.value).slice(0, 4))}
            placeholder={String(currentYear - 5)}
            className={`${inputClass} price`}
          />
        </Question>
      )}

      {step === "mileage" && (
        <Question title={t("mileage.title")} hint={t("mileage.hint")}>
          <div className="relative">
            <input
              autoFocus
              inputMode="numeric"
              value={formatThousands(draft.mileage)}
              onChange={(e) => set("mileage", digitsOnly(e.target.value).slice(0, 7))}
              placeholder="85 000"
              className={`${inputClass} price w-full pr-14`}
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-ink/50">km</span>
          </div>
        </Question>
      )}

      {step === "details" && (
        <Question title={t("details.title")}>
          <ChoiceGroup label={t("details.fuel")}>
            {FUELS.map((fuel) => (
              <Chip key={fuel} selected={draft.fuel === fuel} onClick={() => set("fuel", fuel)}>
                {t(`fuel.${fuel}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={t("details.transmission")}>
            {TRANSMISSIONS.map((value) => (
              <Chip key={value} selected={draft.transmission === value} onClick={() => set("transmission", value)}>
                {t(`transmission.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={t("details.steering")}>
            {STEERINGS.map((value) => (
              <Chip key={value} selected={draft.steering === value} onClick={() => set("steering", value)}>
                {t(`steering.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={t("details.customs")}>
            {([true, false] as const).map((value) => (
              <Chip
                key={String(value)}
                selected={draft.customsCleared === value}
                onClick={() => set("customsCleared", value)}
              >
                {t(value ? "customs.yes" : "customs.no")}
              </Chip>
            ))}
          </ChoiceGroup>
        </Question>
      )}

      {step === "history" && (
        <Question title={tc("history.title")} hint={tc("history.hint")}>
          <ChoiceGroup label={tc("accident")}>
            {ACCIDENTS.map((value) => (
              <Chip key={value} selected={draft.accident === value} onClick={() => set("accident", value)}>
                {tc(`accidents.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={tc("owners")}>
            {["1", "2", "3", "4"].map((value) => (
              <Chip key={value} selected={draft.owners === value} onClick={() => set("owners", value)}>
                {value === "4" ? tc("ownersMany") : tc("ownersCount", { count: Number(value) })}
              </Chip>
            ))}
          </ChoiceGroup>
        </Question>
      )}

      {step === "damage" && (
        <Question title={tc("damageStep.title")} hint={tc("damageStep.hint")}>
          <div className="flex gap-4">
            <DamageDiagram
              damage={draft.damage}
              selected={panel}
              onSelect={setPanel}
              className="h-80 w-auto shrink-0 select-none"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {panel ? (
                <>
                  <p className="text-body font-semibold text-navy">{tc(`panels.${panel}`)}</p>
                  {DAMAGE_KINDS.map((kind) => (
                    <Chip
                      key={kind}
                      selected={draft.damage[panel] === kind}
                      onClick={() => set("damage", { ...draft.damage, [panel]: kind })}
                    >
                      {tc(`kinds.${kind}`)}
                    </Chip>
                  ))}
                  <Chip
                    selected={!draft.damage[panel]}
                    onClick={() => {
                      const rest = { ...draft.damage };
                      delete rest[panel];
                      set("damage", rest);
                    }}
                  >
                    {tc("kinds.ok")}
                  </Chip>
                </>
              ) : (
                <p className="text-body text-ink/60">{tc("damageStep.tapPanel")}</p>
              )}
            </div>
          </div>
          <DamageLegend />
        </Question>
      )}

      {step === "options" && (
        <Question title={tc("optionsStep.title")} hint={tc("optionsStep.hint")}>
          <div className="grid grid-cols-2 gap-2">
            {CAR_OPTIONS.map((option) => {
              const on = draft.options.includes(option);
              return (
                <Chip
                  key={option}
                  selected={on}
                  onClick={() =>
                    set("options", on ? draft.options.filter((o) => o !== option) : [...draft.options, option])
                  }
                >
                  {on ? "✓ " : ""}
                  {tc(`optionNames.${option}`)}
                </Chip>
              );
            })}
          </div>
        </Question>
      )}

      {step === "defects" && (
        <Question title={t("defects.title")} hint={t("defects.hint")}>
          <textarea
            value={draft.defects}
            onChange={(e) => set("defects", e.target.value)}
            placeholder={t("defects.placeholder")}
            rows={4}
            maxLength={500}
            className="rounded-xl border border-ink/15 bg-white p-4 text-body"
          />
        </Question>
      )}

      {step === "photos" && carId && (
        <PhotoStep userId={userId} carId={carId} photos={photos} onChange={setPhotos} />
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-title font-bold text-navy">{t("review.title")}</h1>
          <dl className="divide-y divide-ink/10 rounded-xl bg-white">
            <ReviewRow label={t("review.car")} onEdit={() => goTo("make")} editLabel={t("review.edit")}>
              {draft.make} {draft.model} · {draft.year}
            </ReviewRow>
            <ReviewRow label={t("review.plate")} onEdit={() => goTo("plate")} editLabel={t("review.edit")}>
              <span className="price">{draft.plate}</span>
            </ReviewRow>
            <ReviewRow label={t("review.mileage")} onEdit={() => goTo("mileage")} editLabel={t("review.edit")}>
              <span className="price">{formatKm(Number(draft.mileage))}</span>
            </ReviewRow>
            <ReviewRow label={t("review.options")} onEdit={() => goTo("details")} editLabel={t("review.edit")}>
              {[
                t(`fuel.${draft.fuel}`),
                t(`transmission.${draft.transmission}`),
                t(`steering.${draft.steering}`),
                t(draft.customsCleared ? "customs.yes" : "customs.no"),
              ].join(" · ")}
            </ReviewRow>
            <ReviewRow label={tc("history.short")} onEdit={() => goTo("history")} editLabel={t("review.edit")}>
              {draft.accident ? tc(`accidents.${draft.accident}`) : "—"} ·{" "}
              {draft.owners === "4" ? tc("ownersMany") : tc("ownersCount", { count: Number(draft.owners) || 1 })}
            </ReviewRow>
            <ReviewRow label={tc("damage")} onEdit={() => goTo("damage")} editLabel={t("review.edit")}>
              {Object.keys(draft.damage).length
                ? tc("damageCount", { count: Object.keys(draft.damage).length })
                : tc("noDamage")}
            </ReviewRow>
            <ReviewRow label={tc("options")} onEdit={() => goTo("options")} editLabel={t("review.edit")}>
              {draft.options.length ? draft.options.map((o) => tc(`optionNames.${o}`)).join(", ") : tc("noOptions")}
            </ReviewRow>
            <ReviewRow label={t("review.defects")} onEdit={() => goTo("defects")} editLabel={t("review.edit")}>
              {draft.defects.trim() || t("defects.none")}
            </ReviewRow>
            <ReviewRow label={t("review.photos")} onEdit={() => goTo("photos")} editLabel={t("review.edit")}>
              {t("review.photoCount", {
                count: Object.values(photos).reduce((sum, list) => sum + (list?.length ?? 0), 0),
              })}
            </ReviewRow>
          </dl>

          <PriceEstimate make={draft.make.trim()} model={draft.model.trim()} year={year} />

          <label className="flex flex-col gap-2">
            <span className="text-body font-semibold">{t("review.desiredPrice")}</span>
            <div className="relative">
              <input
                inputMode="numeric"
                value={formatThousands(draft.desiredPrice)}
                onChange={(e) => set("desiredPrice", digitsOnly(e.target.value).slice(0, 12))}
                placeholder="4 500 000"
                className={`${inputClass} price w-full pr-12`}
              />
              <span className="absolute top-1/2 right-4 -translate-y-1/2 text-ink/50">₸</span>
            </div>
            <span className="text-caption text-ink/60">{t("review.desiredPriceHint")}</span>
          </label>

          <p className="text-caption text-ink/70">{t("review.promise")}</p>
        </div>
      )}

      {/* 판매자 화면 원칙: 하단 고정 큰 버튼 하나 */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface pt-2 pb-4">
        {error && <p className="text-caption text-danger">{error}</p>}
        {step === "photos" && !photosComplete && (
          <p className="text-caption text-ink/60">{t("review.photosMissing")}</p>
        )}
        <button
          type="button"
          disabled={!canContinue[step] || busy}
          onClick={next}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-40"
        >
          {busy ? t("saving") : step === "review" ? t("review.start") : t("next")}
        </button>
      </div>
    </div>
  );
}

const inputClass = "h-14 rounded-xl border border-ink/15 bg-white px-4 text-title";

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-navy">{title}</h1>
        {hint && <p className="text-caption text-ink/60">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 rounded-xl border px-3 py-2 text-body font-semibold ${
        selected ? "border-steppe bg-steppe/10 text-navy" : "border-ink/10 bg-white text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-caption text-ink/60">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function ReviewRow({
  label,
  onEdit,
  editLabel,
  children,
}: {
  label: string;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <dt className="w-24 shrink-0 text-caption text-ink/60">{label}</dt>
      <dd className="flex-1 text-body">{children}</dd>
      <button type="button" onClick={onEdit} className="text-caption font-semibold text-steppe">
        {editLabel}
      </button>
    </div>
  );
}
