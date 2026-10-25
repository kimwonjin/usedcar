// 전화번호: 카자흐스탄(+7)과 한국(+82) 휴대폰을 받는다. 저장·로그인은 국제 형식 숫자(7…, 82…)로 한다.

// 입력 중 보기 좋게: 한국 010-1234-5678(3-4-4), 카자흐스탄 +7 701 123-45-67
export function formatPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0")) {
    const d = digits.slice(0, 11);
    return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean).join("-");
  }
  if (digits.startsWith("82")) {
    const d = digits.slice(2, 12);
    return `+82 ${[d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join("-")}`.trim();
  }

  // 카자흐스탄: 8로 시작하면 국가번호 7로 바꾼다. +7 뒤 번호는 항상 7로 시작하므로
  // "70…", "74…"처럼 두 번째 자리가 7이 아니면 국가번호를 빼고 입력한 것이다.
  let kz = digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
  if (kz.startsWith("7") && kz.length > 1 && kz[1] !== "7") kz = `7${kz}`;
  if (!kz.startsWith("7")) kz = `7${kz}`;
  const rest = kz.slice(1, 11);
  let formatted = `+7 ${rest.slice(0, 3)}`;
  if (rest.length > 3) formatted += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) formatted += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) formatted += `-${rest.slice(8, 10)}`;
  return formatted.trim();
}

// 로그인·저장용 국제 형식 숫자. 알 수 없는 형식이면 null
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");

  // 한국: 010XXXXXXXX → 8210XXXXXXXX
  if (/^010\d{8}$/.test(digits)) return `82${digits.slice(1)}`;
  if (/^8210\d{8}$/.test(digits)) return digits;

  // 카자흐스탄: "+7 701 …", "8701…", "701…" → 7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return /^7\d{10}$/.test(digits) ? digits : null;
}
