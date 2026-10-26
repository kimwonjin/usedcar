// 공유 미리보기(OG) 이미지용 글꼴
// 필요한 글자만 담은 글꼴을 Google Fonts에서 받는다 (한글·키릴 문자 표시용). 실패하면 기본 글꼴로 그린다
async function loadFont(family: string, text: string, weight: number) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

// 한글은 Noto Sans KR, 그 글꼴에 없는 ₸ 등은 Noto Sans 로 대신 그린다
const FAMILIES = ["Noto Sans KR", "Noto Sans"];

export async function loadOgFonts(text: string) {
  const loaded = await Promise.all(
    FAMILIES.flatMap((name) =>
      ([700, 400] as const).map(async (weight) => {
        const data = await loadFont(name, text, weight);
        return data ? { name, data, weight, style: "normal" as const } : null;
      }),
    ),
  );
  const fonts = loaded.filter((f) => f !== null);
  return { fonts, fontFamily: fonts.length ? FAMILIES.join(", ") : undefined };
}
