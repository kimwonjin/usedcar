import { notFound } from "next/navigation";

// 없는 주소는 언어별 404 화면으로
export default function CatchAll() {
  notFound();
}
