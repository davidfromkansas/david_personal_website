import { NextRequest, NextResponse } from "next/server";
import { COOKIE, valid } from "@/lib/session";
import publicSlugs from "@/lib/public-slugs.generated.json";
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/share/")) {
    const allowed = (publicSlugs as string[]).some((slug) =>
      [".jpg", ".mp4"].some((ext) => path === "/share/" + slug + ext),
    );
    return allowed
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }
  if (
    path.startsWith("/p/") ||
    path === "/login" ||
    path === "/api/auth" ||
    process.env.NODE_ENV !== "production"
  )
    return NextResponse.next();
  if (
    await valid(
      req.cookies.get(COOKIE)?.value || "",
      process.env.PLAYGROUND_PASSWORD || "",
    )
  ) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (path.startsWith("/api/"))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(login);
}
export const config = {
  matcher: ["/((?!_next/static/|_next/image$|favicon.ico$).*)"],
};
