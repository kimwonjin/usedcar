// PostgREST는 1:1 관계(유니크 FK)를 객체로, 1:N을 배열로 돌려준다. 어느 쪽이든 첫 행을 꺼낸다.
export function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// 경매에 딸린 거래 중 지금 유효한 것: 취소되지 않은 거래, 없으면 가장 최근 거래 (차순위 딜러에게 넘기면 거래가 여러 개다)
export function currentDeal<T extends { status: string; created_at: string }>(value: T | T[] | null | undefined): T | null {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  if (rows.length === 0) return null;
  return rows.find((d) => d.status !== "cancelled") ?? [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
