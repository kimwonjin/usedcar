// 전화번호: 카자흐스탄 휴대폰만 받는다. 화면에서는 10자리(701 234-56-78)만 쓰고, 저장·로그인은 7XXXXXXXXXX(11자리).

// 입력값에서 +7 뒤 10자리만 꺼낸다. "8 701…", "+7 701…", "7701…"처럼 앞자리를 붙여 넣어도 정리한다
export function kzLocalDigits(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) digits = digits.slice(1);
  return digits.slice(0, 10);
}

// 입력 중 표시: 701 234-56-78
export function formatKzLocal(digits: string): string {
  let out = digits.slice(0, 3);
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  return out;
}

// 로그인·저장용 7XXXXXXXXXX. 10자리가 아니면 null
export function normalizePhone(input: string): string | null {
  const local = kzLocalDigits(input);
  // +7 뒤 번호는 항상 7로 시작한다 (700~778 등)
  return /^7\d{9}$/.test(local) ? `7${local}` : null;
}

// 저장된 번호 표시용: 701 234-56-78 (예전 개발 계정의 다른 형식은 그대로)
export function formatPhoneInput(stored: string): string {
  const digits = stored.replace(/\D/g, "");
  if (/^7\d{10}$/.test(digits)) return formatKzLocal(digits.slice(1));
  return stored;
}
