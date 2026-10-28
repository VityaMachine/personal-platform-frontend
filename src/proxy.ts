import { NextResponse, type NextRequest } from "next/server";
import { resolveLegacyTasksUrl } from "./modules/tasks/routes";

// Run before rendering/streaming so legacy URLs receive an HTTP 307, even before login.
export function proxy(request: NextRequest) {
  const href = resolveLegacyTasksUrl(request.nextUrl.pathname, request.nextUrl.searchParams);
  return href ? NextResponse.redirect(new URL(href, request.url), 307) : NextResponse.next();
}

export const config = { matcher: ["/", "/routines"] };
