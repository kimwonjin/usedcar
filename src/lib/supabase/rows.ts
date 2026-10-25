// PostgREST는 1:1 관계(유니크 FK)를 객체로, 1:N을 배열로 돌려준다. 어느 쪽이든 첫 행을 꺼낸다.
export function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
