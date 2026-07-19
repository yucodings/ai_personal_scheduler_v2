import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/projects", "/calendar", "/daily-plan", "/assistant", "/settings"];
export function proxy(request: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (isProtected && !request.cookies.get("skyler_session")) return NextResponse.redirect(new URL("/login", request.url));
  if (request.nextUrl.pathname === "/login" && request.cookies.get("skyler_session")) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/projects/:path*", "/calendar/:path*", "/daily-plan/:path*", "/assistant/:path*", "/settings/:path*", "/login"] };
