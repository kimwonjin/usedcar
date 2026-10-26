"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { DamageDiagram, DamageLegend } from "@/components/damage-diagram";
import { FrameDamagePicker } from "@/components/frame-damage";
import { useRouter } from "@/i18n/navigation";
import { DAMAGE_KINDS, type DamageMap, type FrameDamage, type Panel } from "@/lib/car-catalog";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

// 경매 중 정보 보강: 하자 설명 수정, 외판 표시 추가·변경, 사진 추가만 가능 (기본 정보·기존 사진·기존 표시 삭제는 잠김).
// 입찰·찜 딜러에게 알림이 간다.
export function LiveEdits({
  carId,
  userId,
  defects,
  damage: savedDamage,
  frameDamage: savedFrame,
}: {
  carId: string;
  userId: string;
  defects: string | null;
  damage: DamageMap;
  frameDamage: FrameDamage;
}) {
  const t = useTranslations("liveEdits");
  const tc = useTranslations("condition");
  const [damage, setDamage] = useState<DamageMap>(savedDamage);
  const [panel, setPanel] = useState<Panel | null>(null);
  // 마지막으로 저장된 표시. 이 부위들은 지울 수 없다
  const [baseline, setBaseline] = useState<DamageMap>(savedDamage);
  const [damageSaved, setDamageSaved] = useState(false);
  // 골격: 저장된 부위는 지우거나 낮출 수 없다
  const [frame, setFrame] = useState<FrameDamage>(savedFrame);
  const [frameBaseline, setFrameBaseline] = useState<FrameDamage>(savedFrame);
  const damageChanged = !sameDamage(damage, baseline) || !sameDamage(frame, frameBaseline);
  const router = useRouter();
  const [text, setText] = useState(defects ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveDefects() {
    setBusy(true);
    setError(false);
    const { error } = await createClient().from("cars").update({ defects: text.trim() || null }).eq("id", carId);
    setBusy(false);
    if (error) setError(true);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function saveDamage() {
    setBusy(true);
    setError(false);
    const { error } = await createClient().from("cars").update({ damage, frame_damage: frame }).eq("id", carId);
    setBusy(false);
    if (error) setError(true);
    else {
      setBaseline(damage);
      setFrameBaseline(frame);
      setDamageSaved(true);
    }
  }

  async function addPhoto(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("car-photos", `${userId}/${carId}`, file);
      const { error } = await createClient()
        .from("car_photos")
        .insert({ car_id: carId, slot: "defect", storage_path: path, sort_order: 100 + added });
      if (error) throw error;
      setAdded((n) => n + 1);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-body font-semibold">✏️ {t("title")}</summary>
      <div className="flex flex-col gap-3 border-t border-ink/10 p-4">
        <p className="text-caption text-ink/60">{t("hint")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink/60">{t("defects")}</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={500}
            className="rounded-lg border border-ink/15 bg-white p-3 text-body"
          />
        </label>
        <button
          type="button"
          disabled={busy || text.trim() === (defects ?? "").trim()}
          onClick={saveDefects}
          className="h-11 rounded-lg border border-navy font-semibold text-navy disabled:opacity-40"
        >
          {saved ? `✓ ${t("saved")}` : t("saveDefects")}
        </button>
        <div className="flex flex-col gap-2">
          <span className="text-caption text-ink/60">{tc("damage")}</span>
          <div className="flex gap-3">
            <DamageDiagram damage={damage} selected={panel} onSelect={setPanel} className="h-56 w-auto shrink-0 select-none" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {panel ? (
                <>
                  <p className="text-body font-semibold text-navy">{tc(`panels.${panel}`)}</p>
                  {DAMAGE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={damage[panel] === kind}
                      onClick={() => {
                        setDamage({ ...damage, [panel]: kind });
                        setDamageSaved(false);
                      }}
                      className={`h-10 rounded-lg border text-body font-semibold ${
                        damage[panel] === kind ? "border-steppe bg-steppe/10 text-navy" : "border-ink/10 bg-white"
                      }`}
                    >
                      {tc(`kinds.${kind}`)}
                    </button>
                  ))}
                  {/* 저장된 표시는 지울 수 없다 (DB 규칙과 같음) */}
                  {!baseline[panel] && damage[panel] && (
                    <button
                      type="button"
                      onClick={() => {
                        const rest = { ...damage };
                        delete rest[panel];
                        setDamage(rest);
                      }}
                      className="h-10 rounded-lg border border-ink/10 bg-white text-body text-ink/70"
                    >
                      {tc("kinds.ok")}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-caption text-ink/60">{tc("damageStep.tapPanel")}</p>
              )}
            </div>
          </div>
          <DamageLegend />
          <span className="pt-2 text-caption text-ink/60">{tc("frame.title")}</span>
          <FrameDamagePicker
            value={frame}
            locked={frameBaseline}
            onChange={(next) => {
              setFrame(next);
              setDamageSaved(false);
            }}
          />
          <p className="text-caption text-ink/50">{t("damageLocked")}</p>
          <button
            type="button"
            disabled={busy || !damageChanged}
            onClick={saveDamage}
            className="h-11 rounded-lg border border-navy font-semibold text-navy disabled:opacity-40"
          >
            {damageSaved && !damageChanged ? `✓ ${t("saved")}` : t("saveDamage")}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) addPhoto(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="h-11 rounded-lg border border-ink/15 font-semibold text-steppe disabled:opacity-40"
        >
          📷 {t("addPhoto")} {added > 0 && `(+${added})`}
        </button>
        {error && <p className="text-caption text-danger">{t("failed")}</p>}
      </div>
    </details>
  );
}

// DB(jsonb)는 키 순서를 바꿔 돌려주므로 순서와 무관하게 비교한다
// jsonb는 키 순서를 바꿔 돌려주므로 순서와 무관하게 비교한다 (외판·골격 공용)
function sameDamage(a: Record<string, string | undefined>, b: Record<string, string | undefined>) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
