export type Announcement = {
  id: string;
  audience: "all" | "sellers" | "dealers";
  title: Record<string, string>;
  body: Record<string, string>;
  link: string | null;
  pinned: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

// 언어별 글. 해당 언어가 비어 있으면 러시아어 → 한국어 → 아무 언어 순으로 보여준다
export function localized(text: Record<string, string> | null | undefined, locale: string): string {
  if (!text) return "";
  return text[locale]?.trim() || text.ru?.trim() || text.ko?.trim() || Object.values(text).find((v) => v?.trim()) || "";
}
