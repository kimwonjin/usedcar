import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/proxy";

const intl = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  return updateSession(request, intl(request));
}

export const config = {
  // api, auth 콜백, Next 내부 파일, 정적 파일은 제외
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
