"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { DamageDiagram, DamageLegend } from "@/components/damage-diagram";
import { FrameDamagePicker } from "@/components/frame-damage";
import {
  ACCIDENTS,
  BODY_TYPES,
  CAR_OPTIONS,
  COLORS,
  DAMAGE_KINDS,
  FUELS,
  MIN_YEAR,
  POPULAR_MAKES,
  REQUIRED_SLOTS,
  PANEL_SCRATCHES,
  STEERINGS,
  TIRE_STATES,
  TRANSMISSIONS,
  VIN_PATTERN,
  type Accident,
  type BodyType,
  type CarColor,
  type CarOption,
  type DamageMap,
  type FrameDamage,
  type Fuel,
  type Panel,
  type PanelScratches,
  type Steering,
  type TireState,
  type Transmission,
} from "@/lib/car-catalog";
import { formatKm, formatThousands } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { PhotoStep, type PhotoMap } from "./photo-step";
import { PriceEstimate } from "./price-estimate";
import { ReadyStep } from "./ready-step";

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
  bodyType: BodyType | "";
  color: CarColor | "";
  engineVolume: string;
  vin: string;
  accident: Accident | "";
  owners: string;
  damage: DamageMap;
  frameDamage: FrameDamage;
  spareKey: "" | "yes" | "no";
  tireState: TireState | "";
  wheelScratches: string;
  panelScratches: PanelScratches | "";
  repairNeeded: "" | "yes" | "no";
  options: CarOption[];
  defects: string;
  pros: string;
  desiredPrice: string;
};

const STEPS = ["plate", "make", "model", "year", "mileage", "details", "specs", "history", "damage", "condition", "options", "defects", "ready", "photos", "review"] as const;
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
  bodyType: "",
  color: "",
  engineVolume: "",
  vin: "",
  accident: "",
  owners: "",
  damage: {},
  frameDamage: {},
  spareKey: "",
  tireState: "",
  wheelScratches: "",
  panelScratches: "",
  repairNeeded: "",
  options: [],
  defects: "",
  pros: "",
  desiredPrice: "",
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export type WizardInitial = { carId: string; draft: Draft; photos: PhotoMap };

// S3 차량 정보 입력 → S4 사진 촬영 가이드 → S5 등록 확인. 한 화면에 질문 하나.
export function CarWizard({
  userId,
  currentYear,
  initial,
  prefill,
}: {
  userId: string;
  currentYear: number;
  initial?: WizardInitial;
  prefill?: Partial<Pick<Draft, "make" | "model" | "year">>;
}) {
  const t = useTranslations("carForm");
  const tc = useTranslations("condition");
  const router = useRouter();
  // 이어서 등록할 때는 사진 단계(사진이 다 있으면 확인 단계)부터 시작한다
  const [stepIndex, setStepIndex] = useState(() => {
    if (!initial) return 0;
    const complete = REQUIRED_SLOTS.every((slot) => initial.photos[slot]?.length);
    const none = Object.values(initial.photos).every((list) => !list?.length);
    return STEPS.indexOf(complete ? "review" : none ? "ready" : "photos");
  });
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? { ...initialDraft, ...prefill });
  const [carId, setCarId] = useState<string | null>(initial?.carId ?? null);
  // 차량이 DB에 저장되기 전(하자 단계 이전)까지는 입력 내용을 이 기기에 임시 보관한다
  const localKey = `satu-car-draft:${userId}`;
  const [restorable, setRestorable] = useState<{ draft: Draft; stepIndex: number } | null>(null);
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
  const engine = Number(draft.engineVolume);
  const engineOk = draft.engineVolume === "" || draft.fuel === "electric" || (engine >= 0.6 && engine <= 9.9);
  const photosComplete = REQUIRED_SLOTS.every((slot) => photos[slot]?.length);
  const canContinue: Record<Step, boolean> = {
    plate: /^[0-9A-Z]{5,10}$/.test(draft.plate),
    make: draft.make.trim().length > 0,
    model: draft.model.trim().length > 0,
    year: year >= MIN_YEAR && year <= currentYear + 1,
    mileage: draft.mileage.length > 0,
    details: true,
    specs: draft.bodyType !== "" && (draft.vin === "" || VIN_PATTERN.test(draft.vin)) && engineOk,
    history: draft.accident !== "" && draft.owners !== "",
    damage: true,
    condition:
      draft.spareKey !== "" && draft.tireState !== "" && draft.wheelScratches !== "" && draft.panelScratches !== "" && draft.repairNeeded !== "",
    options: true,
    // 정비·수리가 필요하다고 했으면 어떤 부분인지 적어야 한다
    defects: draft.repairNeeded !== "yes" || draft.defects.trim().length >= 2,
    ready: true,
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
      body_type: draft.bodyType || null,
      color: draft.color || null,
      engine_volume: draft.engineVolume && draft.fuel !== "electric" ? engine : null,
      vin: draft.vin || null,
      accident: draft.accident || null,
      owners: Number(draft.owners) || null,
      damage: draft.damage,
      frame_damage: draft.frameDamage,
      options: draft.options,
      defects: draft.defects.trim() || null,
      spare_key: draft.spareKey === "" ? null : draft.spareKey === "yes",
      tire_state: draft.tireState || null,
      wheel_scratches: draft.wheelScratches === "" ? null : Number(draft.wheelScratches),
      panel_scratches: draft.panelScratches || null,
      repair_needed: draft.repairNeeded === "" ? null : draft.repairNeeded === "yes",
      pros: draft.pros.trim() || null,
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
    } catch (e) {
      // 경매 시작이 DB 규칙으로 막히면 이유를 알려준다
      const message = (e as { message?: string })?.message ?? "";
      setError(
        message.includes("plate already listed")
          ? t("startBlocked.plate")
          : message.includes("too many active auctions")
            ? t("startBlocked.tooMany")
            : t("error"),
      );
    }
    setBusy(false);
  }

  // 새 등록을 열면, 이 기기에 남은 작성 내용이 있는지 확인한다
  useEffect(() => {
    if (initial || prefill?.make) return;
    try {
      const saved = JSON.parse(localStorage.getItem(localKey) ?? "null") as { draft: Draft; stepIndex: number } | null;
      // 외부 저장소에서 읽은 값을 화면에 반영한다
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.draft && saved.stepIndex > 0) setRestorable(saved);
    } catch {}
    // 처음 한 번만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DB 저장 전 단계에서는 입력이 바뀔 때마다 임시 보관, 저장된 뒤에는 지운다
  useEffect(() => {
    if (initial || restorable) return;
    try {
      if (carId) localStorage.removeItem(localKey);
      else if (stepIndex > 0) localStorage.setItem(localKey, JSON.stringify({ draft, stepIndex }));
    } catch {}
  }, [draft, stepIndex, carId, initial, restorable, localKey]);

  const models = POPULAR_MAKES[draft.make] ?? [];
  const makeIsOther = draft.make !== "" && !(draft.make in POPULAR_MAKES);

  if (restorable) {
    const saved = restorable.draft;
    return (
      <div className="flex flex-1 flex-col gap-4 pt-4">
        <h1 className="text-title font-bold text-navy">{t("restore.title")}</h1>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-subtitle font-semibold">
            {[saved.make, saved.model, saved.year].filter(Boolean).join(" ") || saved.plate}
          </p>
          <p className="text-caption text-ink/60">
            {t("restore.progress", { step: restorable.stepIndex + 1, total: STEPS.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft({ ...initialDraft, ...saved });
            setStepIndex(Math.min(restorable.stepIndex, STEPS.indexOf("defects")));
            setRestorable(null);
          }}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white"
        >
          {t("restore.continue")}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(localKey);
            } catch {}
            setRestorable(null);
          }}
          className="h-12 text-body text-ink/60"
        >
          {t("restore.startOver")}
        </button>
      </div>
    );
  }

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
        <span className="price shrink-0 text-caption font-semibold text-ink/60">
          {t("progress", { pct: Math.round(((stepIndex + 1) / STEPS.length) * 100) })}
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

      {step === "specs" && (
        <Question title={t("specs.title")} hint={t("specs.hint")}>
          <ChoiceGroup label={t("specs.bodyType")}>
            {BODY_TYPES.map((value) => (
              <Chip key={value} selected={draft.bodyType === value} onClick={() => set("bodyType", value)}>
                {t(`bodyType.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={t("specs.color")}>
            {COLORS.map((value) => (
              <Chip key={value} selected={draft.color === value} onClick={() => set("color", value)}>
                {t(`color.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          {draft.fuel !== "electric" && (
            <label className="flex flex-col gap-1 text-caption text-ink/60">
              {t("specs.engineVolume")}
              <div className="relative">
                <input
                  inputMode="decimal"
                  value={draft.engineVolume}
                  onChange={(e) => set("engineVolume", e.target.value.replace(",", ".").replace(/[^0-9.]/g, "").slice(0, 3))}
                  placeholder="2.5"
                  className={`${inputClass} price w-full pr-10`}
                />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 text-ink/50">L</span>
              </div>
              {!engineOk && <span className="text-danger">{t("specs.engineInvalid")}</span>}
            </label>
          )}
          <label className="flex flex-col gap-1 text-caption text-ink/60">
            {t("specs.vin")}
            <input
              value={draft.vin}
              onChange={(e) => set("vin", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))}
              placeholder="JTMHV05J804012345"
              className={`${inputClass} price tracking-wider uppercase`}
            />
            <span>{draft.vin && !VIN_PATTERN.test(draft.vin) ? <span className="text-danger">{t("specs.vinInvalid")}</span> : t("specs.vinHint")}</span>
          </label>
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
          <div>
            <p className="text-body font-semibold">{tc("frame.outerTitle")}</p>
            <p className="text-caption text-steppe">{tc("frame.outerHint")}</p>
          </div>
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
          <div className="flex flex-col gap-2 border-t border-ink/10 pt-4">
            <p className="text-body font-semibold">{tc("frame.title")}</p>
            <p className="-mt-1 text-caption text-steppe">{tc("frame.hint")}</p>
            <FrameDamagePicker
              value={draft.frameDamage}
              onChange={(frameDamage) =>
                // 골격 교환·판금이 있으면 큰 사고 (DB에서도 같은 규칙으로 맞춘다)
                setDraft((prev) => ({
                  ...prev,
                  frameDamage,
                  accident: Object.keys(frameDamage).length ? "major" : prev.accident,
                }))
              }
            />
            {Object.keys(draft.frameDamage).length > 0 && (
              <p className="rounded-lg bg-danger/10 p-3 text-caption text-danger">{tc("frame.autoMajor")}</p>
            )}
          </div>
        </Question>
      )}

      {step === "condition" && (
        <Question title={tc("detail.title")} hint={tc("detail.hint")}>
          <ChoiceGroup label={tc("detail.spareKey")}>
            <Chip selected={draft.spareKey === "yes"} onClick={() => set("spareKey", "yes")}>
              🔑🔑 {tc("detail.spareKeyYes")}
            </Chip>
            <Chip selected={draft.spareKey === "no"} onClick={() => set("spareKey", "no")}>
              🔑 {tc("detail.spareKeyNo")}
            </Chip>
          </ChoiceGroup>
          <ChoiceGroup label={tc("detail.tires")} hint={tc("detail.tiresHint")}>
            {TIRE_STATES.map((value) => (
              <Chip key={value} selected={draft.tireState === value} onClick={() => set("tireState", value)}>
                {tc(`detail.tireStates.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={tc("detail.wheels")}>
            {["0", "1", "2", "3", "4"].map((value) => (
              <Chip key={value} selected={draft.wheelScratches === value} onClick={() => set("wheelScratches", value)}>
                {value === "0" ? tc("detail.none") : tc("detail.wheelsCount", { count: Number(value) })}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={tc("detail.panels")} hint={tc("detail.panelsHint")}>
            {PANEL_SCRATCHES.map((value) => (
              <Chip key={value} selected={draft.panelScratches === value} onClick={() => set("panelScratches", value)}>
                {tc(`detail.panelScratches.${value}`)}
              </Chip>
            ))}
          </ChoiceGroup>
          <ChoiceGroup label={tc("detail.repair")}>
            <Chip selected={draft.repairNeeded === "no"} onClick={() => set("repairNeeded", "no")}>
              {tc("detail.none")}
            </Chip>
            <Chip selected={draft.repairNeeded === "yes"} onClick={() => set("repairNeeded", "yes")}>
              {tc("detail.repairYes")}
            </Chip>
          </ChoiceGroup>
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
        <Question
          title={t("defects.title")}
          hint={draft.repairNeeded === "yes" ? t("defects.repairHint") : t("defects.hint")}
        >
          <textarea
            value={draft.defects}
            onChange={(e) => set("defects", e.target.value)}
            placeholder={t("defects.placeholder")}
            rows={4}
            maxLength={500}
            className="rounded-xl border border-ink/15 bg-white p-4 text-body"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-body font-semibold">{t("defects.prosTitle")}</span>
            <textarea
              value={draft.pros}
              onChange={(e) => set("pros", e.target.value)}
              placeholder={t("defects.prosPlaceholder")}
              rows={3}
              maxLength={500}
              className="rounded-xl border border-ink/15 bg-white p-4 text-body"
            />
          </label>
        </Question>
      )}

      {step === "ready" && <ReadyStep car={`${draft.make} ${draft.model} ${draft.year}`} />}

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
            <ReviewRow label={t("specs.short")} onEdit={() => goTo("specs")} editLabel={t("review.edit")}>
              {[
                draft.bodyType && t(`bodyType.${draft.bodyType}`),
                draft.color && t(`color.${draft.color}`),
                draft.engineVolume && draft.fuel !== "electric" && `${draft.engineVolume} L`,
                draft.vin && `VIN ${draft.vin}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ReviewRow>
            <ReviewRow label={tc("history.short")} onEdit={() => goTo("history")} editLabel={t("review.edit")}>
              {draft.accident ? tc(`accidents.${draft.accident}`) : "—"} ·{" "}
              {draft.owners === "4" ? tc("ownersMany") : tc("ownersCount", { count: Number(draft.owners) || 1 })}
            </ReviewRow>
            <ReviewRow label={tc("damage")} onEdit={() => goTo("damage")} editLabel={t("review.edit")}>
              {Object.keys(draft.damage).length
                ? tc("damageCount", { count: Object.keys(draft.damage).length })
                : tc("noDamage")}
              {" · "}
              {Object.keys(draft.frameDamage).length
                ? tc("frame.count", { count: Object.keys(draft.frameDamage).length })
                : tc("frame.none")}
            </ReviewRow>
            <ReviewRow label={tc("detail.short")} onEdit={() => goTo("condition")} editLabel={t("review.edit")}>
              {[
                draft.spareKey && `${tc("detail.spareKeyLabel")} ${tc(draft.spareKey === "yes" ? "detail.has" : "detail.hasNot")}`,
                draft.tireState && `${tc("detail.tiresLabel")}: ${tc(`detail.tireStates.${draft.tireState}`)}`,
                draft.wheelScratches !== "" &&
                  `${tc("detail.wheelsLabel")}: ${draft.wheelScratches === "0" ? tc("detail.none") : tc("detail.wheelsCount", { count: Number(draft.wheelScratches) })}`,
                draft.panelScratches && `${tc("detail.panelsLabel")}: ${tc(`detail.panelScratches.${draft.panelScratches}`)}`,
                draft.repairNeeded && `${tc("detail.repairLabel")}: ${tc(draft.repairNeeded === "yes" ? "detail.repairYes" : "detail.none")}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ReviewRow>
            <ReviewRow label={tc("options")} onEdit={() => goTo("options")} editLabel={t("review.edit")}>
              {draft.options.length ? draft.options.map((o) => tc(`optionNames.${o}`)).join(", ") : tc("noOptions")}
            </ReviewRow>
            <ReviewRow label={t("review.defects")} onEdit={() => goTo("defects")} editLabel={t("review.edit")}>
              {draft.defects.trim() || t("defects.none")}
            </ReviewRow>
            {draft.pros.trim() && (
              <ReviewRow label={tc("detail.pros")} onEdit={() => goTo("defects")} editLabel={t("review.edit")}>
                {draft.pros.trim()}
              </ReviewRow>
            )}
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
          {busy ? t("saving") : step === "review" ? t("review.start") : step === "ready" ? `📷 ${t("ready.upload")}` : t("next")}
        </button>
        {step === "ready" && (
          // 작성 중인 차량으로 저장돼 있어서, 내 차 팔기 화면에서 이어서 올릴 수 있다
          <button type="button" onClick={() => router.push("/sell")} className="h-11 text-body text-ink/60">
            {t("ready.later")}
          </button>
        )}
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

function ChoiceGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body font-semibold text-ink">{label}</legend>
      {hint && <p className="-mt-2 text-caption text-steppe">{hint}</p>}
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
