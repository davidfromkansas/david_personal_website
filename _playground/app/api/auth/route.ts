import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { COOKIE, issue, lifetime } from "@/lib/session";
export async function POST(request: NextRequest) {
  try {
    const password = process.env.PLAYGROUND_PASSWORD;
    if (!password)
      return NextResponse.json(
        { error: "The workspace password has not been configured." },
        { status: 503 },
      );
    const { password: provided } = await request.json();
    if (typeof provided !== "string")
      return NextResponse.json(
        { error: "Enter your password." },
        { status: 400 },
      );
    const hash = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(password), hash(provided)))
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 },
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, await issue(password), {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: lifetime,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to process the request." },
      { status: 400 },
    );
  }
}
