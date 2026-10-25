"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 알림함을 열면 안 읽은 알림을 모두 읽음으로 바꾼다. 화면의 강조 표시는 이번 방문 동안 유지된다.
export function MarkAllRead() {
  useEffect(() => {
    createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .then(() => {});
  }, []);
  return null;
}
