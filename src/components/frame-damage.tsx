"use client";

import { useTranslations } from "next-intl";
import { FRAME_GROUPS, FRAME_PARTS, type FrameDamage, type FrameKind, type FramePart } from "@/lib/car-catalog";

// 누를 때마다 이상 없음 → 판금·용접 → 교환 → 이상 없음
const NEXT: Record<"ok" | FrameKind, FrameKind | null> = { ok: "repaired", repaired: "replaced", replaced: null };

// 골격 손상 선택 (등록·경매 중 추가 공개). locked 부위는 경매 중이라 지우거나 낮출 수 없다
export function FrameDamagePicker({
  value,
  onChange,
  locked = {},
}: {
  value: FrameDamage;
  onChange: (next: FrameDamage) => void;
  locked?: FrameDamage;
}) {
  const t = useTranslations("condition.frame");

  function toggle(part: FramePart) {
    const next = NEXT[value[part] ?? "ok"];
    // 경매 중 이미 알린 부위는 판금 → 교환으로 올리기만 된다
    if (locked[part] && (next === null || (locked[part] === "replaced" && next !== "replaced"))) return;
    const updated = { ...value };
    if (next) updated[part] = next;
    else delete updated[part];
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-ink/60">{t("tapHint")}</p>
      {(Object.keys(FRAME_GROUPS) as (keyof typeof FRAME_GROUPS)[]).map((group) => (
        <div key={group} className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold text-ink/70">{t(`groups.${group}`)}</p>
          <div className="flex flex-wrap gap-1.5">
            {FRAME_GROUPS[group].map((part) => {
              const kind = value[part];
              return (
                <button
                  key={part}
                  type="button"
                  onClick={() => toggle(part)}
                  aria-pressed={Boolean(kind)}
                  className={`rounded-lg border px-2.5 py-1.5 text-caption ${
                    kind === "replaced"
                      ? "border-danger bg-danger text-white"
                      : kind === "repaired"
                        ? "border-danger/60 bg-danger/10 font-semibold text-danger"
                        : "border-ink/15 bg-white"
                  }`}
                >
                  {t(`parts.${part}`)}
                  {kind && ` · ${t(`kinds.${kind}`)}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// 딜러·관리자 상태표용 요약
export function FrameDamageList({ value }: { value: FrameDamage | null }) {
  const t = useTranslations("condition.frame");
  const marked = FRAME_PARTS.filter((part) => value?.[part]);
  return (
    <div className={`rounded-lg p-3 ${marked.length ? "bg-danger/5" : "bg-surface"}`}>
      <p className="mb-1 text-caption text-ink/60">{t("title")}</p>
      {marked.length === 0 ? (
        <p className="text-body font-semibold">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-0.5 text-body">
          {marked.map((part) => (
            <li key={part}>
              {t(`parts.${part}`)} · <span className="font-semibold text-danger">{t(`kinds.${value![part]!}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
