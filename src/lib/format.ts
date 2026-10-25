// 현지 관습: 천 단위 띄어쓰기 (예: 4 500 000)
export function formatThousands(value: number | string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatTenge(amount: number): string {
  return `${formatThousands(Math.round(amount))} ₸`;
}

export function formatKm(km: number): string {
  return `${formatThousands(km)} km`;
}
