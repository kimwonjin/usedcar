// 현지 관습: 천 단위 띄어쓰기 + ₸ (예: 4 500 000 ₸)
export function formatTenge(amount: number): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

export function formatKm(km: number): string {
  return `${String(km).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}
