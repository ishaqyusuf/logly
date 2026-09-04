import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/api/auth", "/_next", "/favicon"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (hasSession && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/events", request.url));
  }
  if (hasSession || isPublicPath(pathname)) return NextResponse.next();

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("return_to", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!api/analytics|v1/|health$|_next/static|_next/image|favicon.ico).*)",
  ],
};
