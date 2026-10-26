// 관리자 화면용 사진 묶음 (누르면 원본을 새 탭에서 연다)
export function PhotoStrip({ title, urls, cols = 4 }: { title: string; urls: string[]; cols?: 4 | 6 }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-semibold">{title}</p>
      <div className={`grid gap-1 ${cols === 6 ? "grid-cols-4 md:grid-cols-6" : "grid-cols-4"}`}>
        {urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
