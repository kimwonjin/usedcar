"use client";

import { formatKzLocal, kzLocalDigits } from "@/lib/phone";

// 카자흐스탄 휴대폰 입력: 10자리를 701 234-56-78(3-3-2-2) 형태로 보여준다.
// 8·+7을 붙여 입력해도 kzLocalDigits가 떼어 낸다
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
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatKzLocal(value)}
        onChange={(e) => onChange(kzLocalDigits(e.target.value))}
        placeholder="701 000-00-00"
        className="price h-14 rounded-xl border border-ink/15 bg-white px-4 text-subtitle outline-none focus:border-navy"
      />
    </label>
  );
}
