import type { PhotoSlot } from "@/lib/car-catalog";

// 촬영 가이드용 간단한 그림. 실제 예시 사진이 준비되면 이미지로 교체한다.
export function SlotPictogram({ slot }: { slot: PhotoSlot }) {
  return (
    <svg
      viewBox="0 0 64 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-16"
      aria-hidden
    >
      {pictograms[slot]}
    </svg>
  );
}

const side = (
  <>
    <path d="M6 28h52v-6l-8-2-8-8H22l-8 8-8 2z" />
    <circle cx="18" cy="29" r="5" />
    <circle cx="46" cy="29" r="5" />
  </>
);

const pictograms: Record<PhotoSlot, React.ReactNode> = {
  front: (
    <>
      <path d="M14 30V18l6-10h24l6 10v12z" />
      <path d="M14 18h36" />
      <rect x="26" y="23" width="12" height="4" />
      <circle cx="19" cy="23" r="2" />
      <circle cx="45" cy="23" r="2" />
    </>
  ),
  rear: (
    <>
      <path d="M14 30V18l6-10h24l6 10v12z" />
      <path d="M20 12h24" />
      <rect x="26" y="22" width="12" height="4" />
      <path d="M16 22h5M43 22h5" />
    </>
  ),
  left: side,
  right: <g transform="translate(64 0) scale(-1 1)">{side}</g>,
  interior: (
    <>
      <circle cx="32" cy="20" r="12" />
      <circle cx="32" cy="20" r="3" />
      <path d="M20 20h9M35 20h9M32 23v9" />
    </>
  ),
  dashboard: (
    <>
      <path d="M12 30a20 20 0 0 1 40 0" />
      <path d="M32 30l9-11" />
      <path d="M16 30h4M44 30h4M32 12v4" />
    </>
  ),
  trunk: (
    <>
      <path d="M8 32h48v-8l-6-2-6-6H20l-6 6-6 2z" />
      <path d="M44 16l10-10" />
      <path d="M50 22V10" strokeDasharray="2 3" />
    </>
  ),
  defect: (
    <>
      <circle cx="28" cy="18" r="10" />
      <path d="M35 25l10 10" />
      <path d="M24 16l3 3 5-6" />
    </>
  ),
};
