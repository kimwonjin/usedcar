"use client";

import { formatThousands } from "@/lib/format";

// 텡게 금액 입력. 값은 숫자 문자열, 화면에는 4 500 000 형식
export function PriceInput({
  value,
  onChange,
  placeholder = "4 500 000",
  autoFocus,
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={formatThousands(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
        placeholder={placeholder}
        className="price h-14 w-full rounded-xl border border-ink/15 bg-white px-4 pr-12 text-title"
      />
      <span className="absolute top-1/2 right-4 -translate-y-1/2 text-ink/50">₸</span>
    </div>
  );
}
