// 카자흐스탄 번호를 7XXXXXXXXXX(11자리)로 맞춘다. "+7 701 …", "8701…", "701…" 모두 허용.
export function normalizeKzPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return /^7\d{10}$/.test(digits) ? digits : null;
}
