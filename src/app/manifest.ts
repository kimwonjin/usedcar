import type { MetadataRoute } from "next";

// 홈 화면에 추가(PWA). 아이폰은 이렇게 설치해야 푸시 알림을 받을 수 있다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Satu — 내 차 팔기 경매",
    short_name: "Satu",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F8FA",
    theme_color: "#14213D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
