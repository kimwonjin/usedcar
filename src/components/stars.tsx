export function Stars({ rating }: { rating: number }) {
  return (
    <span className="price text-caption text-ink/70">
      <span className="text-gold">★</span> {Number(rating).toFixed(1)}
    </span>
  );
}
