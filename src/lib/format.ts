// 현지 관습: 천 단위 띄어쓰기 (예: 4 500 000)
export function formatThousands(value: number | string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// 화면 표시용: 줄바꿈되지 않는 공백(NBSP)으로 묶어 "120 / 000 ₸"처럼 중간에서 끊기지 않게 한다
const NBSP = "\u00a0";
const keepTogether = (text: string) => text.replace(/ /g, NBSP);

export function formatAmount(amount: number): string {
  return keepTogether(formatThousands(Math.round(amount)));
}

export function formatTenge(amount: number): string {
  return `${formatAmount(amount)}${NBSP}₸`;
}

export function formatKm(km: number): string {
  return `${keepTogether(formatThousands(km))}${NBSP}km`;
}
