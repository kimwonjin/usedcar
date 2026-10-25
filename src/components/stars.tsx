// 평점. 아직 후기가 없으면(0) 0.0 대신 — 로 표시
export function Stars({ rating }: { rating: number }) {
  const value = Number(rating);
  return (
    <span className="price text-caption text-ink/70">
      <span className="text-gold">★</span> {value > 0 ? value.toFixed(1) : "—"}
    </span>
  );
}
