"use client";

import { formatKzLocal, kzLocalDigits } from "@/lib/phone";

// 카자흐스탄 휴대폰 입력: +7 고정, 뒤 10자리만 입력
export function PhoneField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // 10자리 숫자
  onChange: (digits: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-caption text-ink/70">{label}</span>
      <div className="flex h-14 items-center overflow-hidden rounded-xl border border-ink/15 bg-white focus-within:border-navy">
        <span className="price flex h-full items-center border-r border-ink/10 bg-surface px-4 text-subtitle font-semibold text-ink/70">
          +7
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={formatKzLocal(value)}
          onChange={(e) => onChange(kzLocalDigits(e.target.value))}
          placeholder="701 000-00-00"
          className="price h-full min-w-0 flex-1 bg-transparent px-4 text-subtitle outline-none"
        />
      </div>
    </label>
  );
}
