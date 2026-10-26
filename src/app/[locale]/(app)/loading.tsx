// 서버에서 화면을 준비하는 동안 보이는 자리표시
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-3 pt-2" aria-busy="true">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-ink/10" />
      <div className="h-24 animate-pulse rounded-xl bg-ink/5" />
      <div className="h-24 animate-pulse rounded-xl bg-ink/5" />
      <div className="h-24 animate-pulse rounded-xl bg-ink/5" />
    </div>
  );
}
